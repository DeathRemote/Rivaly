"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PhaseType } from "@/components/groups/matches/types";
import { getMatchesForGroup } from "@/app/groups/[groupId]/matches/data";

const savePredictionSchema = z.object({
  groupId: z.string().min(1),
  matchKey: z.string().min(1).max(64),
  phaseType: z.enum(["LEAGUE", "GROUP_STAGE", "KNOCKOUT"]),
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  source: z.enum(["QUICK_PICK", "SCORE"]),
});

export type SavePredictionInput = z.infer<typeof savePredictionSchema>;
export type SavePredictionResult =
  | {
      ok: true;
      prediction: {
        matchKey: string;
        homeScore: number;
        awayScore: number;
        source: "QUICK_PICK" | "SCORE";
        updatedAt: string;
      };
    }
  | { ok: false; error: string };

export async function saveGroupPredictionAction(
  input: SavePredictionInput,
): Promise<SavePredictionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = savePredictionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { groupId, matchKey, phaseType, homeScore, awayScore, source } = parsed.data;

  // Membership check
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) return { ok: false, error: "You are not a member of this group." };

  // Match lookup (server-side source of truth for eligibility + lock times)
  const matches = await getMatchesForGroup({ groupId, phaseType: phaseType as PhaseType });
  const match = matches.find((m) => m.id === matchKey);
  if (!match) return { ok: false, error: "Match not found." };

  const now = Date.now();

  const isCompleted = match.status === "FINAL";
  if (isCompleted) return { ok: false, error: "This match is completed." };

  const visibleAt = Date.parse(match.visibleAt);
  const lockAt = Date.parse(match.lockAt);

  const inStandardKickoffWindow =
    Number.isFinite(visibleAt) && Number.isFinite(lockAt) && visibleAt <= now && now < lockAt;

  // Preseason special: if nothing is currently open, allow predictions for the first weekend bucket.
  let allow = inStandardKickoffWindow;

  if (!allow) {
    const anyOpen = matches.some((m) => {
      if (m.status === "FINAL") return false;
      const v = Date.parse(m.visibleAt);
      const l = Date.parse(m.lockAt);
      return Number.isFinite(v) && Number.isFinite(l) && v <= now && now < l;
    });

    if (!anyOpen) {
      const future = matches
        .filter((m) => m.status !== "FINAL")
        .map((m) => ({ id: m.id, t: Date.parse(m.kickoffAt) }))
        .filter((x) => Number.isFinite(x.t) && x.t > now)
        .sort((a, b) => a.t - b.t);

      const first = future[0];
      if (first) {
        const spanMs = 72 * 60 * 60 * 1000;
        const end = first.t + spanMs;
        allow = future.some((x) => x.id === match.id && x.t <= end);
      }
    }
  }

  if (!allow) {
    return { ok: false, error: "Predictions are only allowed for matches in the Kickoff tab." };
  }

  if (Number.isFinite(lockAt) && now >= lockAt) {
    return { ok: false, error: "Predictions are locked for this match." };
  }

  const p = await prisma.groupPrediction.upsert({
    where: { groupId_userId_matchKey: { groupId, userId, matchKey } },
    create: {
      groupId,
      userId,
      matchKey,
      homeScore,
      awayScore,
      source,
    },
    update: {
      homeScore,
      awayScore,
      source,
    },
    select: { matchKey: true, homeScore: true, awayScore: true, source: true, updatedAt: true },
  });

  revalidatePath(`/groups/${groupId}`);

  return {
    ok: true,
    prediction: {
      matchKey: p.matchKey,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      source: p.source,
      updatedAt: p.updatedAt.toISOString(),
    },
  };
}
