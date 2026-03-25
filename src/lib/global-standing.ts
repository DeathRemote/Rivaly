import { prisma } from "@/lib/prisma";

export type GlobalStanding =
  | {
      eligible: true;
      topPercent: number; // e.g. 12.3 means "Top 12.3%"
      cohortSize: number;
      score: number; // 0..1
      breakdown: {
        recent30dAccuracyPct: number;
        lifetimeAccuracyPct: number;
        avgPointsPerScoredPrediction: number;
        scoredPredictionsLifetime: number;
        scoredPredictions30d: number;
      };
    }
  | {
      eligible: false;
      minRequired: number;
      scoredPredictionsLifetime: number;
    };

const MIN_SCORED_PREDICTIONS = 20;

export async function getGlobalStandingForUser(userId: string): Promise<GlobalStanding> {
  const rows = await prisma.$queryRaw<Array<StandingRow>>`
    WITH scored AS (
      SELECT
        p."userId" as "userId",
        m."finalizedAt" as "finalizedAt",

        -- Outcomes
        CASE
          WHEN p."homeScore" = p."awayScore" THEN 'DRAW'
          WHEN p."homeScore" > p."awayScore" THEN 'HOME'
          ELSE 'AWAY'
        END AS "predOutcome",
        CASE
          WHEN r."homeScore" = r."awayScore" THEN 'DRAW'
          WHEN r."homeScore" > r."awayScore" THEN 'HOME'
          ELSE 'AWAY'
        END AS "actualOutcome",

        (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore"))::int as "error",

        CASE
          WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 0 THEN 15
          WHEN (
            CASE
              WHEN p."homeScore" = p."awayScore" THEN 'DRAW'
              WHEN p."homeScore" > p."awayScore" THEN 'HOME'
              ELSE 'AWAY'
            END
          ) <> (
            CASE
              WHEN r."homeScore" = r."awayScore" THEN 'DRAW'
              WHEN r."homeScore" > r."awayScore" THEN 'HOME'
              ELSE 'AWAY'
            END
          ) THEN 0
          WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 1 THEN 10
          WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 2 THEN 8
          WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 3 THEN 6
          ELSE 5
        END::numeric as "points"
      FROM "Prediction" p
      INNER JOIN "Match" m ON m."id" = p."matchId"
      INNER JOIN "MatchResult" r ON r."matchId" = m."id"
      WHERE m."status" = 'FINISHED'
        AND m."finalizedAt" IS NOT NULL
    )
    SELECT
      "userId",
      COUNT(*)::int as "lifetimeTotal",
      SUM(CASE WHEN "predOutcome" = "actualOutcome" THEN 1 ELSE 0 END)::int as "lifetimeCorrect",
      SUM("points")::numeric as "lifetimePoints",
      AVG("points")::numeric as "avgPoints",
      COUNT(*) FILTER (WHERE "finalizedAt" >= (NOW() - INTERVAL '30 days'))::int as "recentTotal",
      SUM(CASE WHEN "finalizedAt" >= (NOW() - INTERVAL '30 days') AND "predOutcome" = "actualOutcome" THEN 1 ELSE 0 END)::int as "recentCorrect"
    FROM scored
    GROUP BY "userId";
  `;

  const me = rows.find((r) => r.userId === userId);
  const myLifetimeTotal = me?.lifetimeTotal ?? 0;

  // If the user hasn’t reached the minimum sample size, show “unranked”.
  if (myLifetimeTotal < MIN_SCORED_PREDICTIONS) {
    return {
      eligible: false,
      minRequired: MIN_SCORED_PREDICTIONS,
      scoredPredictionsLifetime: myLifetimeTotal,
    };
  }

  // Only rank users who meet minimum sample size.
  const eligible = rows.filter((r) => r.lifetimeTotal >= MIN_SCORED_PREDICTIONS);

  const scored = eligible
    .map((r) => ({
      userId: r.userId,
      lifetimeTotal: r.lifetimeTotal,
      lifetimeCorrect: r.lifetimeCorrect,
      recentTotal: r.recentTotal,
      recentCorrect: r.recentCorrect,
      avgPoints: Number(r.avgPoints ?? 0),
      score: computeWeightedScore(r),
    }))
    .sort((a, b) => b.score - a.score);

  const idx = scored.findIndex((x) => x.userId === userId);
  const cohortSize = scored.length;

  // Should not happen if user is eligible, but keep it safe.
  if (idx === -1 || cohortSize === 0) {
    return {
      eligible: false,
      minRequired: MIN_SCORED_PREDICTIONS,
      scoredPredictionsLifetime: myLifetimeTotal,
    };
  }

  const rank = idx + 1; // 1 = best
  const topPercent = round1((rank / cohortSize) * 100);

  const lifetimeAcc = myLifetimeTotal === 0 ? 0 : (me!.lifetimeCorrect / myLifetimeTotal) * 100;
  const recentAcc = me!.recentTotal === 0 ? 0 : (me!.recentCorrect / me!.recentTotal) * 100;

  return {
    eligible: true,
    topPercent,
    cohortSize,
    score: scored[idx]!.score,
    breakdown: {
      recent30dAccuracyPct: round1(recentAcc),
      lifetimeAccuracyPct: round1(lifetimeAcc),
      avgPointsPerScoredPrediction: round1(Number(me!.avgPoints ?? 0)),
      scoredPredictionsLifetime: myLifetimeTotal,
      scoredPredictions30d: me!.recentTotal,
    },
  };
}

function computeWeightedScore(r: StandingRow): number {
  // Weighting goals:
  // - recent form matters (recover from bad start)
  // - lifetime still counts (stability)
  // - points/prediction rewards consistency beyond win/draw/loss correctness
  // - guard against tiny recent samples (smooth towards lifetime)

  const lifetimeAcc = r.lifetimeTotal === 0 ? 0 : r.lifetimeCorrect / r.lifetimeTotal; // 0..1
  // Smooth recent accuracy towards lifetime using a pseudo-count prior.
  const prior = 20; // "20-match" equivalent prior prevents lucky 2/2 from dominating.
  const recentAcc = (r.recentCorrect + prior * lifetimeAcc) / (r.recentTotal + prior);

  // Avg points is 0..15 (per scoring model). Normalize to 0..1.
  const avgPoints = Number(r.avgPoints ?? 0);
  const avgPointsNorm = clamp01(avgPoints / 15);

  // Suggested MVP weighting
  const score = 0.5 * recentAcc + 0.3 * lifetimeAcc + 0.2 * avgPointsNorm;

  return clamp01(score);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

type StandingRow = {
  userId: string;
  lifetimeTotal: number;
  lifetimeCorrect: number;
  lifetimePoints: unknown;
  avgPoints: unknown;
  recentTotal: number;
  recentCorrect: number;
};
