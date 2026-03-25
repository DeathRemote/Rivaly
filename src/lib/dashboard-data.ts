import { prisma } from "@/lib/prisma";

export async function getDashboardData(userId: string) {
  const now = new Date();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      competitionSeasonId: true,
      members: {
        select: {
          userId: true,
          points: true,
          user: { select: { name: true, username: true } },
        },
      },
    },
  });

  const seasonIds = groups.map((g) => g.competitionSeasonId).filter(Boolean) as string[];

  const openMatches =
    seasonIds.length === 0
      ? []
      : await prisma.match.findMany({
          where: {
            competitionSeasonId: { in: seasonIds },
            status: { not: "FINISHED" },
            kickoffAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
            OR: [
              {
                visibleAt: { lte: now },
                lockAt: { gt: now },
              },
              // Fallback if visibleAt/lockAt aren’t set yet: treat kickoff as lock.
              {
                visibleAt: null,
                lockAt: null,
                kickoffAt: { gt: now },
              },
            ],
          },
          select: {
            id: true,
            kickoffAt: true,
            visibleAt: true,
            lockAt: true,
            competitionSeasonId: true,
            homeTeam: { select: { name: true, shortName: true } },
            awayTeam: { select: { name: true, shortName: true } },
          },
          orderBy: { kickoffAt: "asc" },
          take: 50,
        });

  const openMatchIds = openMatches.map((m) => m.id);
  const existingPredictions =
    openMatchIds.length === 0
      ? []
      : await prisma.prediction.findMany({
          where: { userId, matchId: { in: openMatchIds } },
          select: { matchId: true },
        });

  const predictedSet = new Set(existingPredictions.map((p) => p.matchId));
  const matchesToPredict = openMatches.filter((m) => !predictedSet.has(m.id));

  // Group spotlight selection.

  // Count open-needed per group (matches in kickoff window not predicted).
  const openNeededBySeason = new Map<string, number>();
  for (const m of matchesToPredict) {
    openNeededBySeason.set(m.competitionSeasonId, (openNeededBySeason.get(m.competitionSeasonId) ?? 0) + 1);
  }

  const lastActivityByGroup = await prisma.pointsEvent.findMany({
    where: { groupId: { in: groups.map((g) => g.id) } },
    select: { groupId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const latestEventAt = new Map<string, Date>();
  for (const evt of lastActivityByGroup) {
    if (!latestEventAt.has(evt.groupId)) latestEventAt.set(evt.groupId, evt.createdAt);
  }

  const spotlight = pickSpotlightGroup(groups, {
    openNeededBySeason,
    latestEventAt,
  });

  // Map matches to dashboard card data, choosing a groupId route (prefer spotlight group if same season).
  const groupIdBySeason = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.competitionSeasonId) continue;
    const arr = groupIdBySeason.get(g.competitionSeasonId) ?? [];
    arr.push(g.id);
    groupIdBySeason.set(g.competitionSeasonId, arr);
  }

  const kickoffCards = matchesToPredict.map((m) => {
    const seasonGroupIds = groupIdBySeason.get(m.competitionSeasonId) ?? [];
    const groupId =
      spotlight && spotlight.competitionSeasonId === m.competitionSeasonId
        ? spotlight.id
        : seasonGroupIds[0] ?? null;

    return {
      matchId: m.id,
      kickoffAt: m.kickoffAt.toISOString(),
      home: m.homeTeam.shortName ?? m.homeTeam.name,
      away: m.awayTeam.shortName ?? m.awayTeam.name,
      groupId,
      lockAt: (m.lockAt ?? m.kickoffAt).toISOString(),
    };
  });

  // Last result: latest scored prediction (PointsEvent)
  const lastEvent = await prisma.pointsEvent.findFirst({
    where: { userId, type: "PREDICTION_SCORED" },
    orderBy: { createdAt: "desc" },
    select: {
      points: true,
      createdAt: true,
      match: {
        select: {
          id: true,
          kickoffAt: true,
          homeTeam: { select: { name: true, shortName: true } },
          awayTeam: { select: { name: true, shortName: true } },
          result: { select: { homeScore: true, awayScore: true } },
        },
      },
    },
  });

  const lastPrediction = lastEvent
    ? await prisma.prediction.findUnique({
        where: { userId_matchId: { userId, matchId: lastEvent.match.id } },
        select: { homeScore: true, awayScore: true },
      })
    : null;

  const lastResult =
    lastEvent && lastEvent.match.result && lastPrediction
      ? {
          matchLabel: `${lastEvent.match.homeTeam.shortName ?? lastEvent.match.homeTeam.name} vs ${
            lastEvent.match.awayTeam.shortName ?? lastEvent.match.awayTeam.name
          }`,
          home: lastEvent.match.homeTeam.shortName ?? lastEvent.match.homeTeam.name,
          away: lastEvent.match.awayTeam.shortName ?? lastEvent.match.awayTeam.name,
          predicted: `${lastPrediction.homeScore}-${lastPrediction.awayScore}`,
          actual: `${lastEvent.match.result.homeScore}-${lastEvent.match.result.awayScore}`,
          points: lastEvent.points,
          at: lastEvent.createdAt.toISOString(),
        }
      : null;

  // Leaderboard preview for spotlight group
  const spotlightLeaderboard = spotlight
    ? buildTop3(spotlight.members, userId)
    : null;

  return {
    kickoff: {
      matchesToPredict: kickoffCards,
      allOpenCount: openMatches.length,
      remainingCount: matchesToPredict.length,
    },
    lastResult,
    spotlightGroup: spotlight
      ? {
          id: spotlight.id,
          name: spotlight.name,
          leaderboardTop3: spotlightLeaderboard,
          needsToPredictCount: openNeededBySeason.get(spotlight.competitionSeasonId ?? "") ?? 0,
        }
      : null,
  };
}

function pickSpotlightGroup(
  groups: Array<{
    id: string;
    name: string;
    updatedAt: Date;
    competitionSeasonId: string | null;
    members: Array<{ userId: string; points: number; user: { name: string | null; username: string | null } }>;
  }>,
  ctx: {
    openNeededBySeason: Map<string, number>;
    latestEventAt: Map<string, Date>;
  },
) {
  if (groups.length === 0) return null;

  const scored = groups.map((g) => {
    const openNeeded = g.competitionSeasonId
      ? ctx.openNeededBySeason.get(g.competitionSeasonId) ?? 0
      : 0;
    const lastScoredAt = ctx.latestEventAt.get(g.id) ?? null;
    return { ...g, openNeeded, lastScoredAt };
  });

  scored.sort((a, b) => {
    // 1) most matches user still needs to predict
    if (b.openNeeded !== a.openNeeded) return b.openNeeded - a.openNeeded;

    // 2) most recent scored activity
    const at = a.lastScoredAt ? a.lastScoredAt.getTime() : 0;
    const bt = b.lastScoredAt ? b.lastScoredAt.getTime() : 0;
    if (bt !== at) return bt - at;

    // 3) most recently active group
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return scored[0] ?? null;
}

function buildTop3(
  members: Array<{ userId: string; points: number; user: { name: string | null; username: string | null } }>,
  meId: string,
) {
  const sorted = [...members].sort((a, b) => b.points - a.points);
  return sorted.slice(0, 3).map((m, idx) => ({
    position: idx + 1,
    name: m.user.username ?? m.user.name ?? "Unknown",
    points: m.points,
    isYou: m.userId === meId,
    accent: idx === 0 ? ("lime" as const) : idx === 1 ? ("cyan" as const) : ("dim" as const),
  }));
}
