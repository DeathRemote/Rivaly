import { Prisma, Provider } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scorePredictionPoints } from "@/lib/scoring/predictions";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "@/lib/aggregates/recompute";

/**
 * Score a specific match with a provided final score.
 *
 * This is a deterministic, idempotent scorer intended for:
 * - dev/testing
 * - potential admin tooling
 *
 * It mirrors the production scoring pipeline (post-match processor) but does not
 * call external providers.
 */
export async function scoreMatchById(opts: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  providerEventId?: string | null;
  provider?: Provider;
}) {
  const provider = opts.provider ?? Provider.THESPORTSDB;

  const affectedGroupIds = new Set<string>();
  const affectedUserIds = new Set<string>();

  const out = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: opts.matchId },
      select: { id: true, competitionSeasonId: true },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");

    await tx.match.update({
      where: { id: match.id },
      data: { status: "FINISHED", finalizedAt: new Date() },
    });

    await tx.matchResult.upsert({
      where: { matchId: match.id },
      create: {
        matchId: match.id,
        homeScore: opts.homeScore,
        awayScore: opts.awayScore,
        provider,
        providerEventId: opts.providerEventId ?? null,
      },
      update: {
        homeScore: opts.homeScore,
        awayScore: opts.awayScore,
      },
    });

    const predictions = await tx.prediction.findMany({
      where: { matchId: match.id },
      select: { userId: true, homeScore: true, awayScore: true },
    });

    const predictedUserIds = predictions.map((p) => p.userId);
    const predictionByUserId = new Map<string, (typeof predictions)[number]>(
      predictions.map((p) => [p.userId, p] as const),
    );

    const groups = await tx.group.findMany({
      where: { competitionSeasonId: match.competitionSeasonId },
      select: { id: true },
    });

    const groupIds = groups.map((g) => g.id);

    const eligibleMembers =
      groupIds.length === 0 || predictedUserIds.length === 0
        ? []
        : await tx.groupMember.findMany({
            where: {
              groupId: { in: groupIds },
              userId: { in: predictedUserIds },
            },
            select: { groupId: true, userId: true },
          });

    let pointsEvents = 0;

    for (const mbr of eligibleMembers) {
      const p = predictionByUserId.get(mbr.userId);
      if (!p) continue;

      affectedGroupIds.add(mbr.groupId);
      affectedUserIds.add(mbr.userId);

      const scored = scorePredictionPoints({
        predicted: { home: p.homeScore, away: p.awayScore },
        actual: { home: opts.homeScore, away: opts.awayScore },
      });

      try {
        const event = await tx.pointsEvent.create({
          data: {
            groupId: mbr.groupId,
            userId: mbr.userId,
            matchId: match.id,
            type: "PREDICTION_SCORED",
            points: scored.points,
            reason: scored.reason,
            meta: scored.meta,
          },
          select: { points: true },
        });

        await tx.groupMember.updateMany({
          where: { groupId: mbr.groupId, userId: mbr.userId },
          data: { points: { increment: event.points } },
        });

        pointsEvents++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // already scored
        } else {
          throw err;
        }
      }
    }

    return { pointsEvents };
  });

  // Aggregates: sequential, deduped.
  for (const groupId of affectedGroupIds) {
    await recomputeGroupMemberAccuracyAggregate(groupId);
    await recomputeGroupMomentumAggregate(groupId);
  }

  for (const userId of affectedUserIds) {
    await recomputeUserPredictionStatsAggregate(userId);
  }

  return {
    ok: true as const,
    matchId: opts.matchId,
    pointsEvents: out.pointsEvents,
    affectedGroups: Array.from(affectedGroupIds),
    affectedUsers: Array.from(affectedUserIds),
  };
}
