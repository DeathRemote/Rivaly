import { prisma } from "@/lib/prisma";

export type SwipeMatch = {
  matchId: string;
  kickoffAt: string;
  lockAt: string;
  competitionLabel: string;
  home: { name: string; shortName?: string | null };
  away: { name: string; shortName?: string | null };
  // A representative group context for authorization + navigation.
  groupId: string;
};

export async function getSwipeMatchesForUser(userId: string): Promise<SwipeMatch[]> {
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

  // Only matches in the kickoff prediction window.
  const matches = await prisma.match.findMany({
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

  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);

  const existing = await prisma.prediction.findMany({
    where: { userId, matchId: { in: matchIds } },
    select: { matchId: true },
  });

  const predicted = new Set(existing.map((p) => p.matchId));

  const out: SwipeMatch[] = [];

  for (const m of matches) {
    if (predicted.has(m.id)) continue;

    const seasonGroupIds = groupIdsBySeason.get(m.competitionSeasonId) ?? [];
    const groupId = seasonGroupIds[0];
    if (!groupId) continue;

    const competitionLabel = `${m.competitionSeason.competition.name} ${m.competitionSeason.seasonLabel}`;

    out.push({
      matchId: m.id,
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
