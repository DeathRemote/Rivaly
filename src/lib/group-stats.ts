import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { winnerOf } from "@/lib/scoring/predictions";

// Note: group-level derived reads should be served from aggregates whenever possible.

export type GroupMemberAccuracy = {
  scored: number;
  correct: number;
  last7d: number;
  prev7d: number;
};

export type GroupMemberAccuracyByUserId = Record<string, GroupMemberAccuracy>;

async function _getGroupMemberAccuracies(groupId: string): Promise<GroupMemberAccuracyByUserId> {
  // Read from precomputed aggregates.
  const rows = await prisma.groupMemberAccuracyAggregate.findMany({
    where: { groupId },
    select: {
      userId: true,
      scoredTotal: true,
      correctTotal: true,
      last7d: true,
      prev7d: true,
    },
  });

  const byUser: GroupMemberAccuracyByUserId = {};
  for (const r of rows) {
    byUser[r.userId] = {
      scored: r.scoredTotal,
      correct: r.correctTotal,
      last7d: r.last7d,
      prev7d: r.prev7d,
    };
  }

  return byUser;
}

export const getGroupMemberAccuracies = unstable_cache(
  async (groupId: string) => _getGroupMemberAccuracies(groupId),
  ["group-member-accuracies"],
  // Derived data is now written by jobs; keep cache window long.
  { revalidate: 600 },
);

async function _getGroupCompletedMatchFeed(opts: {
  groupId: string;
  limitMatches?: number;
}) {
  const limitMatches = opts.limitMatches ?? 6;

  // Most recent scored activity by match.
  // PERF: use `distinct` so we don't fetch hundreds of rows just to dedupe in JS.
  const recent = await prisma.pointsEvent.findMany({
    where: { groupId: opts.groupId, type: "PREDICTION_SCORED" },
    orderBy: { createdAt: "desc" },
    distinct: ["matchId"],
    take: limitMatches,
    select: { matchId: true },
  });

  const matchIds = recent.map((r) => r.matchId);

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
  // Feed is nice-to-have; keep revalidation less aggressive.
  { revalidate: 120 },
);

async function _getGroupMomentum(groupId: string) {
  const row = await prisma.groupMomentumAggregate.findUnique({
    where: { groupId },
    select: {
      momentumPctCached: true,
      totalScored: true,
      correctScored: true,
      memberCountSnapshot: true,
      windowStart: true,
      windowEnd: true,
    },
  });

  // If aggregates aren't populated yet, return a safe default instead of
  // doing expensive runtime recomputation.
  if (!row) {
    return {
      momentumPct: 0,
      riskLabel: "LOW" as const,
      accuracyPct: 0,
      activityScore: 0,
      windowDays: 14,
      explanation: "Momentum is being computed. Check back shortly.",
    };
  }

  const total = row.totalScored;
  const correct = row.correctScored;
  const memberCount = row.memberCountSnapshot;

  const accuracyPct = total === 0 ? 0 : (correct / total) * 100;
  const eventsPerMember = memberCount === 0 ? 0 : total / memberCount;
  const activityScore = clamp01(eventsPerMember / 10) * 100;

  const momentumPct = Math.round(clamp01(row.momentumPctCached / 100) * 100);
  const riskLabel = momentumPct >= 70 ? "HIGH" : momentumPct >= 40 ? "MED" : "LOW";

  // windowDays derived for display.
  const windowDays = Math.max(
    1,
    Math.round((row.windowEnd.getTime() - row.windowStart.getTime()) / (24 * 60 * 60 * 1000)),
  );

  return {
    momentumPct,
    riskLabel,
    accuracyPct: round1(accuracyPct),
    activityScore: round1(activityScore),
    windowDays,
    explanation:
      "Momentum v1 = 70% group accuracy (14D) + 30% activity (scored predictions per member, capped).",
  };
}

export const getGroupMomentum = unstable_cache(
  async (groupId: string) => _getGroupMomentum(groupId),
  ["group-momentum"],
  // Aggregated; keep cache window long.
  { revalidate: 600 },
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
