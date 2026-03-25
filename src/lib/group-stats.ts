import type { Prisma } from "@prisma/client";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { winnerOf } from "@/lib/scoring/predictions";

async function _getGroupMemberAccuracies(groupId: string) {
  const events = await prisma.pointsEvent.findMany({
    where: { groupId, type: "PREDICTION_SCORED" },
    select: { userId: true, meta: true, createdAt: true },
  });

  const byUser = new Map<
    string,
    {
      scored: number;
      correct: number;
      last7d: number;
      prev7d: number;
    }
  >();

  const now = Date.now();
  const d7 = 7 * 24 * 60 * 60 * 1000;

  for (const e of events) {
    const meta = (e.meta ?? {}) as Prisma.JsonObject;
    const model = meta as unknown as { winnerCorrect?: boolean };

    const cur = byUser.get(e.userId) ?? { scored: 0, correct: 0, last7d: 0, prev7d: 0 };
    cur.scored += 1;
    if (model.winnerCorrect) cur.correct += 1;

    const age = now - e.createdAt.getTime();
    if (age <= d7) cur.last7d += 1;
    else if (age <= 2 * d7) cur.prev7d += 1;

    byUser.set(e.userId, cur);
  }

  return byUser;
}

// Cache: group-level derived reads can be reused briefly.
export const getGroupMemberAccuracies = unstable_cache(
  async (groupId: string) => _getGroupMemberAccuracies(groupId),
  ["group-member-accuracies"],
  { revalidate: 30 },
);

export async function getGroupCompletedMatchFeed(opts: {
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
      meta: true,
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

async function _getGroupMomentum(groupId: string) {
  // Momentum v1: blend recent group accuracy + activity.
  // Window: last 14 days.
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [events, memberCount] = await Promise.all([
    prisma.pointsEvent.findMany({
      where: { groupId, type: "PREDICTION_SCORED", createdAt: { gte: from } },
      select: { meta: true, userId: true, points: true },
    }),
    prisma.groupMember.count({ where: { groupId } }),
  ]);

  let correct = 0;
  let total = 0;

  for (const e of events) {
    const meta = (e.meta ?? {}) as Prisma.JsonObject;
    const model = meta as unknown as { winnerCorrect?: boolean };
    total += 1;
    if (model.winnerCorrect) correct += 1;
  }

  const accuracyPct = total === 0 ? 0 : (correct / total) * 100;
  const eventsPerMember = memberCount === 0 ? 0 : total / memberCount;

  // Activity score: 10 scored predictions per member in 14D = maxed.
  const activityScore = clamp01(eventsPerMember / 10) * 100;

  const momentumPct = Math.round(clamp01(0.7 * (accuracyPct / 100) + 0.3 * (activityScore / 100)) * 100);

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
