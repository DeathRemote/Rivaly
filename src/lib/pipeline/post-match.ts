import { prisma } from "@/lib/prisma";
import { Prisma, Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { scorePredictionPoints } from "@/lib/scoring/predictions";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";
import { mapTheSportsDbStatus } from "@/lib/importers/thesportsdb/map";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "@/lib/aggregates/recompute";

export async function syncAndProcessFinishedMatches(opts?: {
  maxMatches?: number;
  lookbackHours?: number;
  lookaheadMinutes?: number;
}) {
  const maxMatches = opts?.maxMatches ?? 25;

  // IMPORTANT DESIGN CHOICE:
  // Provider status can lag reality (e.g. remains "2H" after the match is actually done).
  // If we only look at a narrow kickoffAt window, we can miss scoring entirely.
  // So we primarily scan for "unprocessed" matches within a bounded recent period.
  //
  // Overrides remain for dev/tests, but defaults are chosen for reliability.
  const lookbackHours = opts?.lookbackHours ?? 24 * 7; // 7 days
  const lookaheadMinutes = opts?.lookaheadMinutes ?? 0; // we don't need to look ahead for finished scoring

  const now = new Date();
  const from = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  // Candidates: unprocessed + recent-ish.
  // We do NOT filter by status here — if a match is FINISHED but unprocessed, we must still pick it up.
  // We also avoid looking too far back to prevent hammering the provider.
  const candidates = await prisma.match.findMany({
    where: {
      processedAt: null,
      provider: Provider.THESPORTSDB,
      providerMatchId: { not: null },
      kickoffAt: { gte: from, lte: to },
    },
    orderBy: { kickoffAt: "asc" },
    take: maxMatches,
    include: {
      competitionSeason: { include: { competition: true } },
    },
  });

  if (candidates.length === 0) {
    return { skipped: true as const, scanned: 0, processed: [] as const };
  }

  console.info("[post-match] candidates:", {
    scanned: candidates.length,
    from: from.toISOString(),
    to: to.toISOString(),
    maxMatches,
  });

  const client = new TheSportsDbClient();

  const processed: Array<{ matchId: string; pointsEvents: number; standingsSynced: boolean }> = [];

  for (const m of candidates) {
    const providerId = m.providerMatchId;
    if (!providerId) continue;

    const evt = await client.lookupEvent(providerId);
    if (!evt) continue;

    const mappedStatus = mapTheSportsDbStatus(evt.strStatus);

    if (mappedStatus !== "FINISHED") {
      // Update status if provider says something else.
      if (mappedStatus !== m.status) {
        await prisma.match.update({
          where: { id: m.id },
          data: { status: mappedStatus },
        });
      }
      continue;
    }

    // Finished: must have scores.
    const homeScore = evt.intHomeScore;
    const awayScore = evt.intAwayScore;
    if (typeof homeScore !== "number" || typeof awayScore !== "number") {
      // Some providers mark finished but scores missing; retry next run.
      continue;
    }

    // Transaction for idempotency:
    // - upsert MatchResult
    // - score predictions once via PointsEvent unique constraint
    // - update GroupMember points
    // - mark Match.processedAt
    const out = await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: m.id },
        data: { status: "FINISHED", finalizedAt: new Date() },
      });

      await tx.matchResult.upsert({
        where: { matchId: m.id },
        create: {
          matchId: m.id,
          homeScore,
          awayScore,
          provider: Provider.THESPORTSDB,
          providerEventId: providerId,
        },
        update: {
          homeScore,
          awayScore,
        },
      });

      // Load predictions for this match (global per user+match).
      const predictions = await tx.prediction.findMany({
        where: { matchId: m.id },
        select: { userId: true, homeScore: true, awayScore: true },
      });

      const predictedUserIds = predictions.map((p) => p.userId);
      const predictionByUserId = new Map<string, (typeof predictions)[number]>(
        predictions.map((p) => [p.userId, p] as const),
      );

      // Score per-group: apply the same prediction to every group that uses this competition season,
      // but only for users who are members of that group.
      const groups = await tx.group.findMany({
        where: { competitionSeasonId: m.competitionSeasonId },
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

      const affectedGroupIds = new Set<string>();
      const affectedUserIds = new Set<string>();

      for (const mbr of eligibleMembers) {
        const p = predictionByUserId.get(mbr.userId);
        if (!p) continue;

        const scored = scorePredictionPoints({
          predicted: { home: p.homeScore, away: p.awayScore },
          actual: { home: homeScore, away: awayScore },
        });

        // Ledger event: must be truly idempotent.
        // IMPORTANT: we only increment GroupMember.points if we successfully CREATE a new PointsEvent.
        // Otherwise, repeated job runs / concurrent runs could double-increment points.
        affectedGroupIds.add(mbr.groupId);
        affectedUserIds.add(mbr.userId);

        try {
          const event = await tx.pointsEvent.create({
            data: {
              groupId: mbr.groupId,
              userId: mbr.userId,
              matchId: m.id,
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
          // Unique constraint (groupId,userId,matchId,type) => already scored.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // no-op
          } else {
            throw err;
          }
        }
      }

      await tx.match.update({
        where: { id: m.id },
        data: { processedAt: new Date() },
      });

      return {
        pointsEvents,
        affectedGroupIds: Array.from(affectedGroupIds),
        affectedUserIds: Array.from(affectedUserIds),
      };
    });

    // Update aggregates after scoring is committed.
    // Important: do this AFTER the scoring transaction so jobs see a consistent state.
    // Also keep it sequential + deduped to avoid introducing new pool spikes.
    try {
      for (const groupId of out.affectedGroupIds) {
        await recomputeGroupMemberAccuracyAggregate(groupId);
        await recomputeGroupMomentumAggregate(groupId);
      }

      // Recompute per affected user once (deduped). Keep sequential.
      for (const userId of out.affectedUserIds) {
        await recomputeUserPredictionStatsAggregate(userId);
      }
    } catch (err) {
      console.warn("[aggregates] recompute failed after match processing:", err instanceof Error ? err.message : err);
    }

    // Standings update after processing.
    let standingsSynced = false;
    try {
      await syncCompetitionSeasonStandings({ competitionSeasonId: m.competitionSeasonId });
      standingsSynced = true;
    } catch (err) {
      console.warn("[standings] sync failed after match processing:", err instanceof Error ? err.message : err);
    }

    processed.push({ matchId: m.id, pointsEvents: out.pointsEvents, standingsSynced });
  }

  return {
    skipped: false as const,
    scanned: candidates.length,
    processed,
  };
}
