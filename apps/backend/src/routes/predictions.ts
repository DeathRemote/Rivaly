import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";
import { inSeasonOpeningWindow, inStandardKickoffWindow } from "../prediction-window.js";

const savePredictionSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  source: z.enum(["QUICK_PICK", "SCORE"]),
});

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

export async function registerPredictionRoutes(app: FastifyInstance) {
  app.post("/api/internal/predictions", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const body = savePredictionSchema.parse(req.body);
      const { matchId, homeScore, awayScore, source } = body;

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

      if (!match) return { ok: false, error: "Match not found." } as const;

      if (match.status === "FINISHED") return { ok: false, error: "This match is completed." } as const;
      if (match.status === "CANCELED" || match.status === "POSTPONED") {
        return { ok: false, error: "This match is not currently predictable." } as const;
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
        return { ok: false, error: "You are not eligible to predict this match." } as const;
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
        } as const;
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

      const result: SavePredictionResult = {
        ok: true,
        prediction: {
          matchId: p.matchId,
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          source: p.source,
          updatedAt: p.updatedAt.toISOString(),
        },
      };

      return result;
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ ok: false, error: err?.message ?? "Bad Request" } satisfies SavePredictionResult);
    }
  });
}
