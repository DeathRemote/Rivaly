import type { FastifyInstance } from "fastify";

import { z } from "zod";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type DashboardPayload = {
  standing:
    | {
        eligible: true;
        topPercent: number;
        cohortSize: number;
        score: number;
        breakdown: {
          recent30dAccuracyPct: number;
          lifetimeAccuracyPct: number;
          avgPointsPerScoredPrediction: number;
          scoredPredictionsLifetime: number;
          scoredPredictions30d: number;
        };
      }
    | { eligible: false; minRequired: number; scoredPredictionsLifetime: number };
  dash: {
    kickoff: {
      matchesToPredict: Array<{
        matchId: string;
        kickoffAt: string;
        home: string;
        away: string;
        groupId: string | null;
        lockAt: string;
      }>;
      allOpenCount: number;
      remainingCount: number;
    };
    lastResult:
      | null
      | {
          matchLabel: string;
          home: string;
          away: string;
          predicted: string;
          actual: string;
          points: number;
          at: string;
        };
    spotlightGroup:
      | null
      | {
          id: string;
          name: string;
          leaderboardTop3: Array<{
            position: number;
            name: string;
            points: number;
            isYou: boolean;
            accent: "lime" | "cyan" | "dim";
          }>;
          needsToPredictCount: number;
        };
  };
};

const MIN_SCORED_PREDICTIONS = 20;

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/internal/dashboard", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const query = z
        .object({
          // allow tuning in future
        })
        .parse(req.query);
      void query;

      const [standing, dash] = await Promise.all([getGlobalStanding(userId), getDashboard(userId)]);

      const payload: DashboardPayload = { standing, dash };

      reply.header("Cache-Control", "private, max-age=15");
      return payload;
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}

async function getGlobalStanding(userId: string): Promise<DashboardPayload["standing"]> {
  // Use the precomputed aggregates table (updated by pipeline) rather than scanning predictions.
  const me = await prisma.userPredictionStatsAggregate.findUnique({
    where: { userId },
    select: {
      lifetimeTotal: true,
      lifetimeCorrect: true,
      avgPoints: true,
      recent30dTotal: true,
      recent30dCorrect: true,
    },
  });

  const myLifetimeTotal = me?.lifetimeTotal ?? 0;

  if (myLifetimeTotal < MIN_SCORED_PREDICTIONS) {
    return {
      eligible: false,
      minRequired: MIN_SCORED_PREDICTIONS,
      scoredPredictionsLifetime: myLifetimeTotal,
    };
  }

  // Compute weighted score in SQL and derive rank + cohort size without loading all users.
  // Weighting: 0.5 * recentSmoothedAcc + 0.3 * lifetimeAcc + 0.2 * avgPoints/15
  // Smoothing prior=20
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      cohortSize: number;
      rank: number;
      score: number;
      lifetimeTotal: number;
      lifetimeCorrect: number;
      recentTotal: number;
      recentCorrect: number;
      avgPoints: number;
    }>
  >`
    WITH eligible AS (
      SELECT
        "userId",
        "lifetimeTotal",
        "lifetimeCorrect",
        "recent30dTotal"  AS "recentTotal",
        "recent30dCorrect" AS "recentCorrect",
        "avgPoints"
      FROM "UserPredictionStatsAggregate"
      WHERE "lifetimeTotal" >= ${MIN_SCORED_PREDICTIONS}
    ),
    scored AS (
      SELECT
        e.*,
        CASE WHEN e."lifetimeTotal" = 0 THEN 0 ELSE (e."lifetimeCorrect"::float / e."lifetimeTotal") END AS "lifetimeAcc",
        (
          (e."recentCorrect"::float + 20.0 * (CASE WHEN e."lifetimeTotal" = 0 THEN 0 ELSE (e."lifetimeCorrect"::float / e."lifetimeTotal") END))
          /
          (e."recentTotal"::float + 20.0)
        ) AS "recentAccSmoothed",
        GREATEST(0.0, LEAST(1.0, (COALESCE(e."avgPoints", 0)::float / 15.0))) AS "avgPointsNorm"
      FROM eligible e
    ),
    ranked AS (
      SELECT
        s."userId",
        s."lifetimeTotal",
        s."lifetimeCorrect",
        s."recentTotal",
        s."recentCorrect",
        s."avgPoints",
        (0.5 * s."recentAccSmoothed" + 0.3 * s."lifetimeAcc" + 0.2 * s."avgPointsNorm") AS "score",
        DENSE_RANK() OVER (ORDER BY (0.5 * s."recentAccSmoothed" + 0.3 * s."lifetimeAcc" + 0.2 * s."avgPointsNorm") DESC)::int AS "rank",
        COUNT(*) OVER ()::int AS "cohortSize"
      FROM scored s
    )
    SELECT * FROM ranked WHERE "userId" = ${userId};
  `;

  const meRanked = rows[0];
  if (!meRanked) {
    // Fallback (shouldn't happen)
    return {
      eligible: false,
      minRequired: MIN_SCORED_PREDICTIONS,
      scoredPredictionsLifetime: myLifetimeTotal,
    };
  }

  const topPercent = round1((meRanked.rank / meRanked.cohortSize) * 100);
  const lifetimeAcc = meRanked.lifetimeTotal === 0 ? 0 : (meRanked.lifetimeCorrect / meRanked.lifetimeTotal) * 100;
  const recentAcc = meRanked.recentTotal === 0 ? 0 : (meRanked.recentCorrect / meRanked.recentTotal) * 100;

  return {
    eligible: true,
    topPercent,
    cohortSize: meRanked.cohortSize,
    score: clamp01(meRanked.score),
    breakdown: {
      recent30dAccuracyPct: round1(recentAcc),
      lifetimeAccuracyPct: round1(lifetimeAcc),
      avgPointsPerScoredPrediction: round1(meRanked.avgPoints ?? 0),
      scoredPredictionsLifetime: meRanked.lifetimeTotal,
      scoredPredictions30d: meRanked.recentTotal,
    },
  };
}

async function getDashboard(userId: string): Promise<DashboardPayload["dash"]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      competitionSeasonId: true,
      members: {
        orderBy: { points: "desc" },
        take: 3,
        select: {
          userId: true,
          points: true,
          user: { select: { name: true, username: true } },
        },
      },
    },
  });

  // Get swipe-eligible matches using the same query logic the web app used.
  // (Duplicated here to keep the dashboard fully backend-driven.)
  const matchesToPredict = await getSwipeMatchesForUser(userId, 80);

  const openNeededBySeason = new Map<string, number>();
  for (const m of matchesToPredict) {
    openNeededBySeason.set(m.competitionSeasonId, (openNeededBySeason.get(m.competitionSeasonId) ?? 0) + 1);
  }

  const lastActivityByGroup = await prisma.pointsEvent.groupBy({
    by: ["groupId"],
    where: { groupId: { in: groups.map((g) => g.id) } },
    _max: { createdAt: true },
  });

  const latestEventAt = new Map<string, Date>();
  for (const r of lastActivityByGroup) {
    if (r._max.createdAt) latestEventAt.set(r.groupId, r._max.createdAt);
  }

  const spotlight = pickSpotlightGroup(groups, { openNeededBySeason, latestEventAt });

  const groupIdBySeason = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.competitionSeasonId) continue;
    const arr = groupIdBySeason.get(g.competitionSeasonId) ?? [];
    arr.push(g.id);
    groupIdBySeason.set(g.competitionSeasonId, arr);
  }

  const kickoffCards = matchesToPredict.map((m) => {
    const seasonGroupIds = groupIdBySeason.get(m.competitionSeasonId) ?? [];
    const routeGroupId = spotlight && spotlight.competitionSeasonId === m.competitionSeasonId ? spotlight.id : seasonGroupIds[0] ?? m.groupId ?? null;

    return {
      matchId: m.matchId,
      kickoffAt: m.kickoffAt,
      home: m.home.shortName ?? m.home.name,
      away: m.away.shortName ?? m.away.name,
      groupId: routeGroupId,
      lockAt: m.lockAt,
    };
  });

  const lastEvent = await prisma.pointsEvent.findFirst({
    where: { userId, type: "PREDICTION_SCORED" },
    orderBy: { createdAt: "desc" },
    select: {
      points: true,
      createdAt: true,
      match: {
        select: {
          id: true,
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
          matchLabel: `${lastEvent.match.homeTeam.shortName ?? lastEvent.match.homeTeam.name} vs ${lastEvent.match.awayTeam.shortName ?? lastEvent.match.awayTeam.name}`,
          home: lastEvent.match.homeTeam.shortName ?? lastEvent.match.homeTeam.name,
          away: lastEvent.match.awayTeam.shortName ?? lastEvent.match.awayTeam.name,
          predicted: `${lastPrediction.homeScore}-${lastPrediction.awayScore}`,
          actual: `${lastEvent.match.result.homeScore}-${lastEvent.match.result.awayScore}`,
          points: lastEvent.points,
          at: lastEvent.createdAt.toISOString(),
        }
      : null;

  const spotlightLeaderboard = spotlight ? buildTop3(spotlight.members, userId) : [];

  return {
    kickoff: {
      matchesToPredict: kickoffCards.map((c) => ({
        ...c,
        kickoffAt: new Date(c.kickoffAt).toISOString(),
        lockAt: new Date(c.lockAt).toISOString(),
      })),
      allOpenCount: matchesToPredict.length,
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

type SwipeMatch = {
  matchId: string;
  competitionSeasonId: string;
  kickoffAt: string;
  lockAt: string;
  home: { name: string; shortName?: string | null };
  away: { name: string; shortName?: string | null };
  groupId: string;
};

async function getSwipeMatchesForUser(userId: string, limit: number): Promise<SwipeMatch[]> {
  const now = new Date();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, competitionSeasonId: true },
  });

  const seasonIds = Array.from(new Set(groups.map((g) => g.competitionSeasonId).filter(Boolean) as string[]));
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
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
    },
    orderBy: { kickoffAt: "asc" },
    take: limit,
  });

  let matches = await excludeAlreadyPredicted(standardOpen);

  if (matches.length === 0) {
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
        competitionSeason: { select: { startsAt: true } },
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
      orderBy: [{ competitionSeasonId: "asc" }, { kickoffAt: "asc" }],
      take: Math.max(250, limit * 3),
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

  const out: SwipeMatch[] = [];

  for (const m of matches) {
    const seasonGroupIds = groupIdsBySeason.get(m.competitionSeasonId) ?? [];
    const groupId = seasonGroupIds[0];
    if (!groupId) continue;

    out.push({
      matchId: m.id,
      competitionSeasonId: m.competitionSeasonId,
      kickoffAt: m.kickoffAt.toISOString(),
      lockAt: (m.lockAt ?? m.kickoffAt).toISOString(),
      home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName },
      away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName },
      groupId,
    });
  }

  return out;
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
    const openNeeded = g.competitionSeasonId ? ctx.openNeededBySeason.get(g.competitionSeasonId) ?? 0 : 0;
    const lastScoredAt = ctx.latestEventAt.get(g.id) ?? null;
    return { ...g, openNeeded, lastScoredAt };
  });

  scored.sort((a, b) => {
    if (b.openNeeded !== a.openNeeded) return b.openNeeded - a.openNeeded;
    const at = a.lastScoredAt ? a.lastScoredAt.getTime() : 0;
    const bt = b.lastScoredAt ? b.lastScoredAt.getTime() : 0;
    if (bt !== at) return bt - at;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return scored[0] ?? null;
}

function buildTop3(
  members: Array<{ userId: string; points: number; user: { name: string | null; username: string | null } }>,
  meId: string,
) {
  return members.slice(0, 3).map((m, idx) => ({
    position: idx + 1,
    name: m.user.username ?? m.user.name ?? "Unknown",
    points: m.points,
    isYou: m.userId === meId,
    accent: idx === 0 ? ("lime" as const) : idx === 1 ? ("cyan" as const) : ("dim" as const),
  }));
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
