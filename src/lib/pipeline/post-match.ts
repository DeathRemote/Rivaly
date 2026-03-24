import { prisma } from "@/lib/prisma";
import { Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { scorePredictionPoints } from "@/lib/scoring/predictions";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";
import { mapTheSportsDbStatus } from "@/lib/importers/thesportsdb/map";

export async function syncAndProcessFinishedMatches(opts?: {
  maxMatches?: number;
}) {
  const maxMatches = opts?.maxMatches ?? 25;

  // Candidates: matches that should have started already and are not processed.
  // We include a grace window so we don't spam provider far into the future.
  const now = new Date();
  const startedBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.match.findMany({
    where: {
      kickoffAt: { lte: now, gte: startedBefore },
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

      // Load predictions for this matchKey across all groups.
      const predictions = await tx.groupPrediction.findMany({
        where: { matchKey: m.id },
        select: { groupId: true, userId: true, homeScore: true, awayScore: true },
      });

      let pointsEvents = 0;

      for (const p of predictions) {
        const scored = scorePredictionPoints({
          predicted: { home: p.homeScore, away: p.awayScore },
          actual: { home: homeScore, away: awayScore },
        });

        // Upsert ledger event (unique prevents double scoring)
        const event = await tx.pointsEvent.upsert({
          where: {
            groupId_userId_matchId_type: {
              groupId: p.groupId,
              userId: p.userId,
              matchId: m.id,
              type: "PREDICTION_SCORED",
            },
          },
          create: {
            groupId: p.groupId,
            userId: p.userId,
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

        // Only increment if this was a new event.
        // Prisma upsert doesn't tell us if create vs update; we enforce idempotency by never changing processedAt once set.
        // We only run scoring while match.processedAt is null, so this upsert should be "create" in normal flow.
        await tx.groupMember.updateMany({
          where: { groupId: p.groupId, userId: p.userId },
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
    scanned: candidates.length,
    processed,
  };
}
