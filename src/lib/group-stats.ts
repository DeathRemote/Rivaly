import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { winnerOf } from "@/lib/scoring/predictions";

// Note: group-level derived reads can be reused briefly.

async function _getGroupMemberAccuracies(groupId: string) {
  const now = new Date();
  const d7 = 7 * 24 * 60 * 60 * 1000;
  const from7 = new Date(now.getTime() - d7);
  const from14 = new Date(now.getTime() - 2 * d7);

  // Avoid pulling all events into memory (can grow unbounded).
  // We approximate winnerCorrect as points > 0 (wrong predictions score 0).
  const [total, correct, last7, prev7] = await Promise.all([
    prisma.pointsEvent.groupBy({
      by: ["userId"],
      where: { groupId, type: "PREDICTION_SCORED" },
      _count: { _all: true },
    }),
    prisma.pointsEvent.groupBy({
      by: ["userId"],
      where: { groupId, type: "PREDICTION_SCORED", points: { gt: 0 } },
      _count: { _all: true },
    }),
    prisma.pointsEvent.groupBy({
      by: ["userId"],
      where: { groupId, type: "PREDICTION_SCORED", createdAt: { gte: from7 } },
      _count: { _all: true },
    }),
    prisma.pointsEvent.groupBy({
      by: ["userId"],
      where: {
        groupId,
        type: "PREDICTION_SCORED",
        createdAt: { gte: from14, lt: from7 },
      },
      _count: { _all: true },
    }),
  ]);

  const byUser = new Map<
    string,
    {
      scored: number;
      correct: number;
      last7d: number;
      prev7d: number;
    }
  >();

  for (const r of total) {
    byUser.set(r.userId, {
      scored: r._count._all,
      correct: 0,
      last7d: 0,
      prev7d: 0,
    });
  }

  for (const r of correct) {
    const cur = byUser.get(r.userId) ?? { scored: 0, correct: 0, last7d: 0, prev7d: 0 };
    cur.correct = r._count._all;
    byUser.set(r.userId, cur);
  }

  for (const r of last7) {
    const cur = byUser.get(r.userId) ?? { scored: 0, correct: 0, last7d: 0, prev7d: 0 };
    cur.last7d = r._count._all;
    byUser.set(r.userId, cur);
  }

  for (const r of prev7) {
    const cur = byUser.get(r.userId) ?? { scored: 0, correct: 0, last7d: 0, prev7d: 0 };
    cur.prev7d = r._count._all;
    byUser.set(r.userId, cur);
  }

  return byUser;
}

export const getGroupMemberAccuracies = unstable_cache(
  async (groupId: string) => _getGroupMemberAccuracies(groupId),
  ["group-member-accuracies"],
  { revalidate: 30 },
);

async function _getGroupCompletedMatchFeed(opts: {
  groupId: string;
  limitMatches?: number;
}) {
  const limitMatches = opts.limitMatches ?? 6;

  // Most recent scored activity by match.
  const recent = await prisma.pointsEvent.findMany({
    where: { groupId: opts.groupId, type: "PREDICTION_SCORED" },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { matchId: true },
  });

  const matchIds: string[] = [];
  const seen = new Set<string>();
  for (const r of recent) {
    if (seen.has(r.matchId)) continue;
    seen.add(r.matchId);
    matchIds.push(r.matchId);
    if (matchIds.length >= limitMatches) break;
  }

  if (matchIds.length === 0) {
    return [] as Array<CompletedMatchItem>;
  }

  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: {
      id: true,
      kickoffAt: true,
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
      result: { select: { homeScore: true, awayScore: true } },
    },
  });
  const matchById = new Map(matches.map((m) => [m.id, m] as const));

  const events = await prisma.pointsEvent.findMany({
    where: {
      groupId: opts.groupId,
      type: "PREDICTION_SCORED",
      matchId: { in: matchIds },
    },
    select: {
      userId: true,
      matchId: true,
      points: true,
      user: { select: { name: true, username: true, image: true } },
    },
    orderBy: { points: "desc" },
  });

  const userIds = Array.from(new Set(events.map((e) => e.userId)));

  const predictions = await prisma.prediction.findMany({
    where: { matchId: { in: matchIds }, userId: { in: userIds } },
    select: { userId: true, matchId: true, homeScore: true, awayScore: true },
  });

  const predByKey = new Map(predictions.map((p) => [`${p.userId}:${p.matchId}`, p] as const));

  const outcomesByMatch = new Map<string, Array<CompletedMatchOutcome>>();

  for (const e of events) {
    const p = predByKey.get(`${e.userId}:${e.matchId}`);
    const m = matchById.get(e.matchId);
    if (!m?.result || !p) continue;

    const predictedOutcome = winnerOf({ home: p.homeScore, away: p.awayScore });
    const actualOutcome = winnerOf({ home: m.result.homeScore, away: m.result.awayScore });

    const correctness: CompletedMatchOutcome["correctness"] =
      predictedOutcome !== actualOutcome
        ? "wrong"
        : p.homeScore === m.result.homeScore && p.awayScore === m.result.awayScore
          ? "exact"
          : "correct";

    const arr = outcomesByMatch.get(e.matchId) ?? [];
    arr.push({
      userId: e.userId,
      name: e.user.username ?? e.user.name ?? "Unknown",
      image: e.user.image ?? null,
      predictionLabel: `${p.homeScore}-${p.awayScore}`,
      points: e.points,
      correctness,
    });
    outcomesByMatch.set(e.matchId, arr);
  }

  // Preserve match order as matchIds (recent first)
  const out: CompletedMatchItem[] = [];
  for (const matchId of matchIds) {
    const m = matchById.get(matchId);
    if (!m || !m.result) continue;

    out.push({
      matchId,
      kickoffAt: m.kickoffAt.toISOString(),
      fixtureLabel: `${m.homeTeam.shortName ?? m.homeTeam.name} vs ${m.awayTeam.shortName ?? m.awayTeam.name}`,
      home: m.homeTeam.shortName ?? m.homeTeam.name,
      away: m.awayTeam.shortName ?? m.awayTeam.name,
      finalScoreLabel: `${m.result.homeScore}-${m.result.awayScore}`,
      outcomes: (outcomesByMatch.get(matchId) ?? []).slice(0, 10),
    });
  }

  return out;
}

export const getGroupCompletedMatchFeed = unstable_cache(
  async (opts: { groupId: string; limitMatches?: number }) => _getGroupCompletedMatchFeed(opts),
  ["group-completed-feed"],
  { revalidate: 30 },
);

async function _getGroupMomentum(groupId: string) {
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [totalCount, correctCount, memberCount] = await Promise.all([
    prisma.pointsEvent.count({
      where: { groupId, type: "PREDICTION_SCORED", createdAt: { gte: from } },
    }),
    prisma.pointsEvent.count({
      where: { groupId, type: "PREDICTION_SCORED", createdAt: { gte: from }, points: { gt: 0 } },
    }),
    prisma.groupMember.count({ where: { groupId } }),
  ]);

  const total = totalCount;
  const correct = correctCount;

  const accuracyPct = total === 0 ? 0 : (correct / total) * 100;
  const eventsPerMember = memberCount === 0 ? 0 : total / memberCount;

  // Activity score: 10 scored predictions per member in 14D = maxed.
  const activityScore = clamp01(eventsPerMember / 10) * 100;

  const momentumPct = Math.round(
    clamp01(0.7 * (accuracyPct / 100) + 0.3 * (activityScore / 100)) * 100,
  );

  const riskLabel = momentumPct >= 70 ? "HIGH" : momentumPct >= 40 ? "MED" : "LOW";

  return {
    momentumPct,
    riskLabel,
    accuracyPct: round1(accuracyPct),
    activityScore: round1(activityScore),
    windowDays: 14,
    explanation:
      "Momentum v1 = 70% group accuracy (last 14 days) + 30% activity (scored predictions per member, capped).",
  };
}

export const getGroupMomentum = unstable_cache(
  async (groupId: string) => _getGroupMomentum(groupId),
  ["group-momentum"],
  { revalidate: 30 },
);

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export type CompletedMatchOutcome = {
  userId: string;
  name: string;
  image: string | null;
  predictionLabel: string;
  points: number;
  correctness: "exact" | "correct" | "wrong";
};

export type CompletedMatchItem = {
  matchId: string;
  kickoffAt: string;
  fixtureLabel: string;
  home: string;
  away: string;
  finalScoreLabel: string;
  outcomes: CompletedMatchOutcome[];
};
