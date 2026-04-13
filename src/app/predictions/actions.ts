"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";
import { inSeasonOpeningWindow, inStandardKickoffWindow } from "@/lib/prediction-window";

const savePredictionSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  source: z.enum(["QUICK_PICK", "SCORE"]),
});

export type SavePredictionInput = z.infer<typeof savePredictionSchema>;

export type SavePredictionResult =
  | {
      ok: true;
      prediction: {
        matchId: string;
        homeScore: number;
        awayScore: number;
        source: "QUICK_PICK" | "SCORE";
        updatedAt: string;
      };
    }
  | { ok: false; error: string };

export async function savePredictionAction(
  input: SavePredictionInput,
): Promise<SavePredictionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = savePredictionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { matchId, homeScore, awayScore, source } = parsed.data;

  // Prefer backend when configured (keeps writes off the Next.js runtime).
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();

  if (backendBase && backendSecret) {
    try {
      const bearer = await signBackendUserToken({ userId, secret: backendSecret });

      const res = await fetch(`${backendBase}/api/internal/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId,
          homeScore,
          awayScore,
          source,
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn("Backend save prediction failed", res.status, await res.text());
      } else {
        const data = (await res.json()) as SavePredictionResult;
        if (data.ok) {
          revalidatePath("/swipe");
          revalidatePath("/dashboard");
          revalidatePath("/groups");
        }
        return data;
      }
    } catch (err) {
      console.warn("Backend save prediction threw", err);
    }

    // Fall back to local DB path instead of breaking swipe.
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      kickoffAt: true,
      visibleAt: true,
      lockAt: true,
      competitionSeasonId: true,
    },
  });

  if (!match) return { ok: false, error: "Match not found." };

  if (match.status === "FINISHED") return { ok: false, error: "This match is completed." };
  if (match.status === "CANCELED" || match.status === "POSTPONED") {
    return { ok: false, error: "This match is not currently predictable." };
  }

  // Authorization: user must be a member of at least one group that uses this competition season.
  const membership = await prisma.groupMember.findFirst({
    where: {
      userId,
      group: { competitionSeasonId: match.competitionSeasonId },
    },
    select: { id: true },
  });

  if (!membership) {
    return { ok: false, error: "You are not eligible to predict this match." };
  }

  const allowStandard = inStandardKickoffWindow({
    kickoffAt: match.kickoffAt,
    visibleAt: match.visibleAt,
    lockAt: match.lockAt,
  });

  let allow = allowStandard;

  // Season-start exception: if the season has not started yet, allow predicting the opening bucket.
  if (!allow) {
    allow = await inSeasonOpeningWindow({
      competitionSeasonId: match.competitionSeasonId,
      matchId: match.id,
      bucketHours: 72,
    });
  }

  if (!allow) {
    return {
      ok: false,
      error: "Predictions are only allowed for matches currently in the Kickoff window.",
    };
  }

  const p = await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId } },
    create: {
      userId,
      matchId,
      homeScore,
      awayScore,
      source,
    },
    update: {
      homeScore,
      awayScore,
      source,
    },
    select: { matchId: true, homeScore: true, awayScore: true, source: true, updatedAt: true },
  });

  // Revalidate high-level surfaces.
  revalidatePath("/swipe");
  revalidatePath("/dashboard");
  revalidatePath("/groups");

  return {
    ok: true,
    prediction: {
      matchId: p.matchId,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      source: p.source,
      updatedAt: p.updatedAt.toISOString(),
    },
  };
}
