import { JobType, MatchStatus, Provider } from "@prisma/client";

import { prisma } from "../../prisma.js";
import { TheSportsDbClient } from "../../providers/thesportsdb/client.js";
import { mapTheSportsDbStatus } from "../../importers/thesportsdb/map.js";
import { enqueueJob } from "../dbQueue.js";

export async function runMatchesScheduler(opts?: {
  maxMatches?: number;
  lookbackHours?: number;
  lookaheadMinutes?: number;
}) {
  const maxMatches = opts?.maxMatches ?? 50;
  // Provider status/scores can be delayed by many hours (sometimes >24h).
  // Default to a 7-day window so we don't miss matches that finish but update late.
  const lookbackHours = opts?.lookbackHours ?? 7 * 24;
  const lookaheadMinutes = opts?.lookaheadMinutes ?? 60;

  const now = new Date();
  const from = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  const candidates = await prisma.match.findMany({
    where: {
      processedAt: null,
      provider: Provider.THESPORTSDB,
      providerMatchId: { not: null },
      kickoffAt: { gte: from, lte: to },
    },
    orderBy: { kickoffAt: "asc" },
    take: maxMatches,
    select: {
      id: true,
      status: true,
      kickoffAt: true,
      providerMatchId: true,
      competitionSeasonId: true,
    },
  });

  if (candidates.length === 0) {
    return { skipped: true as const, scanned: 0, enqueued: 0, updated: 0 };
  }

  console.info("[scheduler] match candidates", {
    scanned: candidates.length,
    from: from.toISOString(),
    to: to.toISOString(),
    maxMatches,
  });

  const client = new TheSportsDbClient();

  let enqueued = 0;
  let updated = 0;

  for (const m of candidates) {
    const providerId = m.providerMatchId;
    if (!providerId) continue;

    const evt = await client.lookupEvent(providerId);
    if (!evt) continue;

    const mappedStatus = mapTheSportsDbStatus(evt.strStatus);

    if (mappedStatus !== m.status) {
      await prisma.match.update({
        where: { id: m.id },
        data: { status: mappedStatus },
      });
      updated++;
    }

    if (mappedStatus !== MatchStatus.FINISHED) continue;

    const homeScore = evt.intHomeScore;
    const awayScore = evt.intAwayScore;
    if (typeof homeScore !== "number" || typeof awayScore !== "number") {
      continue;
    }

    // Enqueue scoring per match (deduped by matchId).
    await enqueueJob({
      type: JobType.SCORE_MATCH,
      dedupeKey: m.id,
      payload: {
        matchId: m.id,
        competitionSeasonId: m.competitionSeasonId,
        homeScore,
        awayScore,
        providerEventId: providerId,
      },
    });

    enqueued++;
  }

  return {
    skipped: false as const,
    scanned: candidates.length,
    enqueued,
    updated,
  };
}
