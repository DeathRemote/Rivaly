import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export type SwipeMatch = {
  matchId: string;
  competitionSeasonId: string;
  kickoffAt: string;
  lockAt: string;
  competitionLabel: string;
  home: { name: string; shortName?: string | null };
  away: { name: string; shortName?: string | null };
  // A representative group context for navigation (saving is global, not group-scoped).
  groupId: string;
};

async function _getSwipeMatchesForUser(userId: string): Promise<SwipeMatch[]> {
  const now = new Date();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, competitionSeasonId: true },
  });

  const seasonIds = Array.from(
    new Set(groups.map((g) => g.competitionSeasonId).filter(Boolean) as string[]),
  );

  if (seasonIds.length === 0) return [];

  const groupIdsBySeason = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.competitionSeasonId) continue;
    const arr = groupIdsBySeason.get(g.competitionSeasonId) ?? [];
    arr.push(g.id);
    groupIdsBySeason.set(g.competitionSeasonId, arr);
  }

  async function excludeAlreadyPredicted<T extends { id: string }>(items: T[]) {
    if (items.length === 0) return [] as T[];

    const existing = await prisma.prediction.findMany({
      where: { userId, matchId: { in: items.map((m) => m.id) } },
      select: { matchId: true },
    });

    const predicted = new Set(existing.map((p) => p.matchId));
    return items.filter((m) => !predicted.has(m.id));
  }

  // Swipe needs: matches open now.
  // If there are no *remaining* matches after excluding already predicted, fall back to a small upcoming bucket.
  const standardOpen = await prisma.match.findMany({
    where: {
      competitionSeasonId: { in: seasonIds },
      status: { in: ["SCHEDULED", "LIVE", "UNKNOWN"] },
      visibleAt: { lte: now },
      lockAt: { gt: now },
    },
    select: {
      id: true,
      kickoffAt: true,
      lockAt: true,
      competitionSeasonId: true,
      competitionSeason: { select: { seasonLabel: true, competition: { select: { name: true } } } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
    },
    orderBy: { kickoffAt: "asc" },
    take: 80,
  });

  let matches = await excludeAlreadyPredicted(standardOpen);

  if (matches.length === 0) {
    // Upcoming bucket: show the first bucket (first 72 hours from the earliest kickoff) per season.
    // This prevents "All caught up" when the only open matches are already predicted,
    // but another season has fixtures farther out (e.g. outside visibleAt window).
    const upcoming = await prisma.match.findMany({
      where: {
        competitionSeasonId: { in: seasonIds },
        status: { in: ["SCHEDULED", "LIVE", "UNKNOWN"] },
        kickoffAt: { gt: now },
      },
      select: {
        id: true,
        kickoffAt: true,
        lockAt: true,
        competitionSeasonId: true,
        competitionSeason: {
          select: {
            seasonLabel: true,
            startsAt: true,
            competition: { select: { name: true } },
          },
        },
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
      orderBy: [{ competitionSeasonId: "asc" }, { kickoffAt: "asc" }],
      take: 250,
    });

    const firstKickoffBySeason = new Map<string, Date>();
    for (const m of upcoming) {
      if (!firstKickoffBySeason.has(m.competitionSeasonId)) {
        firstKickoffBySeason.set(m.competitionSeasonId, m.kickoffAt);
      }
    }

    const bucketMs = 72 * 60 * 60 * 1000;

    const bucket = upcoming.filter((m) => {
      const seasonStart = m.competitionSeason.startsAt;
      if (seasonStart && seasonStart.getTime() <= now.getTime()) return false;

      const first = firstKickoffBySeason.get(m.competitionSeasonId);
      if (!first) return false;

      return m.kickoffAt.getTime() <= first.getTime() + bucketMs;
    });

    matches = await excludeAlreadyPredicted(bucket);
  }

  if (matches.length === 0) return [];

  const out: SwipeMatch[] = [];

  for (const m of matches) {

    const seasonGroupIds = groupIdsBySeason.get(m.competitionSeasonId) ?? [];
    const groupId = seasonGroupIds[0];
    if (!groupId) continue;

    const competitionLabel = `${m.competitionSeason.competition.name} ${m.competitionSeason.seasonLabel}`;

    out.push({
      matchId: m.id,
      competitionSeasonId: m.competitionSeasonId,
      kickoffAt: m.kickoffAt.toISOString(),
      lockAt: (m.lockAt ?? m.kickoffAt).toISOString(),
      competitionLabel,
      home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName },
      away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName },
      groupId,
    });
  }

  return out;
}

export const getSwipeMatchesForUser = unstable_cache(
  async (userId: string) => _getSwipeMatchesForUser(userId),
  ["swipe-matches-for-user"],
  // Swipe + dashboard call this frequently; tolerate small staleness to reduce DB spikes.
  { revalidate: 30 },
);
