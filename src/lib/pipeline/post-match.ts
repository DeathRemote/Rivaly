import { prisma } from "@/lib/prisma";
import { Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { scorePredictionPoints } from "@/lib/scoring/predictions";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";
import { mapTheSportsDbStatus } from "@/lib/importers/thesportsdb/map";

export async function syncAndProcessFinishedMatches(opts?: {
  maxMatches?: number;
  lookbackHours?: number;
  lookaheadMinutes?: number;
}) {
  const maxMatches = opts?.maxMatches ?? 25;
  const lookbackHours = opts?.lookbackHours ?? 6;
  const lookaheadMinutes = opts?.lookaheadMinutes ?? 60;

  const now = new Date();
  const from = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  // Candidates: relevant window + not processed.
  // Keep it tight so the cron can run every 5 minutes without hammering the provider.
  const candidates = await prisma.match.findMany({
    where: {
      kickoffAt: { gte: from, lte: to },
      processedAt: null,
      provider: Provider.THESPORTSDB,
      providerMatchId: { not: null },
      status: { in: ["SCHEDULED", "LIVE", "UNKNOWN", "POSTPONED"] },
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

      for (const mbr of eligibleMembers) {
        const p = predictionByUserId.get(mbr.userId);
        if (!p) continue;

        const scored = scorePredictionPoints({
          predicted: { home: p.homeScore, away: p.awayScore },
          actual: { home: homeScore, away: awayScore },
        });

        // Upsert ledger event (unique prevents double scoring)
        const event = await tx.pointsEvent.upsert({
          where: {
            groupId_userId_matchId_type: {
              groupId: mbr.groupId,
              userId: mbr.userId,
              matchId: m.id,
              type: "PREDICTION_SCORED",
            },
          },
          create: {
            groupId: mbr.groupId,
            userId: mbr.userId,
            matchId: m.id,
            type: "PREDICTION_SCORED",
            points: scored.points,
            reason: scored.reason,
            meta: scored.meta,
          },
          update: {
            // If we ever want to re-score, we'd need a different strategy.
            points: scored.points,
            reason: scored.reason,
            meta: scored.meta,
          },
          select: { id: true, points: true },
        });

        await tx.groupMember.updateMany({
          where: { groupId: mbr.groupId, userId: mbr.userId },
          data: { points: { increment: event.points } },
        });

        pointsEvents++;
      }

      await tx.match.update({
        where: { id: m.id },
        data: { processedAt: new Date() },
      });

      return { pointsEvents };
    });

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
