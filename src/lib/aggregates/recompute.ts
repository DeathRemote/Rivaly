import { prisma } from "@/lib/prisma";

/**
 * Aggregate recomputation functions.
 *
 * Goals:
 * - deterministic + idempotent
 * - safe to run repeatedly
 * - bounded + pool-friendly (avoid fan-out / huge concurrency)
 */

export async function recomputeGroupMemberAccuracyAggregate(groupId: string) {
  const now = new Date();
  const d7 = 7 * 24 * 60 * 60 * 1000;
  const from7 = new Date(now.getTime() - d7);
  const from14 = new Date(now.getTime() - 2 * d7);

  // One statement upsert for ALL members (including zero-event members).
  // Uses PointsEvent because that's the canonical "scored" stream.
  // correctness heuristic: points > 0 == correct winner.
  await prisma.$executeRaw`
    INSERT INTO "GroupMemberAccuracyAggregate" (
      "id",
      "groupId",
      "userId",
      "scoredTotal",
      "correctTotal",
      "last7d",
      "prev7d",
      "accuracyPctCached",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text as "id",
      gm."groupId" as "groupId",
      gm."userId" as "userId",
      COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED'), 0) as "scoredTotal",
      COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED' AND pe."points" > 0), 0) as "correctTotal",
      COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED' AND pe."createdAt" >= ${from7}), 0) as "last7d",
      COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED' AND pe."createdAt" >= ${from14} AND pe."createdAt" < ${from7}), 0) as "prev7d",
      CASE
        WHEN COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED'), 0) = 0 THEN 0
        ELSE
          (COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED' AND pe."points" > 0), 0)::float
            / COALESCE(COUNT(pe.*) FILTER (WHERE pe."type" = 'PREDICTION_SCORED'), 0)::float) * 100
      END as "accuracyPctCached",
      ${now}::timestamp as "updatedAt"
    FROM "GroupMember" gm
    LEFT JOIN "PointsEvent" pe
      ON pe."groupId" = gm."groupId"
      AND pe."userId" = gm."userId"
      AND pe."type" = 'PREDICTION_SCORED'
      AND pe."createdAt" >= ${from14}
    WHERE gm."groupId" = ${groupId}
    GROUP BY gm."groupId", gm."userId"
    ON CONFLICT ("groupId", "userId") DO UPDATE SET
      "scoredTotal" = EXCLUDED."scoredTotal",
      "correctTotal" = EXCLUDED."correctTotal",
      "last7d" = EXCLUDED."last7d",
      "prev7d" = EXCLUDED."prev7d",
      "accuracyPctCached" = EXCLUDED."accuracyPctCached",
      "updatedAt" = EXCLUDED."updatedAt";
  `;

  return { ok: true as const };
}

export async function recomputeGroupMomentumAggregate(groupId: string) {
  const now = new Date();
  const windowDays = 14;
  const from = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Momentum matches the runtime model:
  // 70% accuracy (scored events) + 30% activity (scored per member, capped at 10).
  // Compute everything in one statement and upsert.
  await prisma.$executeRaw`
    INSERT INTO "GroupMomentumAggregate" (
      "id",
      "groupId",
      "totalScored",
      "correctScored",
      "memberCountSnapshot",
      "momentumPctCached",
      "windowStart",
      "windowEnd",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text as "id",
      ${groupId}::text as "groupId",
      COALESCE((SELECT COUNT(*) FROM "PointsEvent" WHERE "groupId" = ${groupId} AND "type" = 'PREDICTION_SCORED' AND "createdAt" >= ${from}), 0)::int as "totalScored",
      COALESCE((SELECT COUNT(*) FROM "PointsEvent" WHERE "groupId" = ${groupId} AND "type" = 'PREDICTION_SCORED' AND "createdAt" >= ${from} AND "points" > 0), 0)::int as "correctScored",
      COALESCE((SELECT COUNT(*) FROM "GroupMember" WHERE "groupId" = ${groupId}), 0)::int as "memberCountSnapshot",
      (
        -- momentumPctCached
        CASE
          WHEN COALESCE((SELECT COUNT(*) FROM "GroupMember" WHERE "groupId" = ${groupId}), 0) = 0 THEN 0
          ELSE (
            WITH t AS (
              SELECT
                COALESCE((SELECT COUNT(*) FROM "PointsEvent" WHERE "groupId" = ${groupId} AND "type" = 'PREDICTION_SCORED' AND "createdAt" >= ${from}), 0)::float AS total,
                COALESCE((SELECT COUNT(*) FROM "PointsEvent" WHERE "groupId" = ${groupId} AND "type" = 'PREDICTION_SCORED' AND "createdAt" >= ${from} AND "points" > 0), 0)::float AS correct,
                COALESCE((SELECT COUNT(*) FROM "GroupMember" WHERE "groupId" = ${groupId}), 0)::float AS members
            )
            SELECT
              ROUND(
                LEAST(
                  1,
                  GREATEST(
                    0,
                    0.7 * (CASE WHEN t.total = 0 THEN 0 ELSE (t.correct / t.total) END)
                    + 0.3 * LEAST(1, ((CASE WHEN t.members = 0 THEN 0 ELSE (t.total / t.members) END) / 10))
                  )
                )
                * 100
              )::int
            FROM t
          )
        END
      ) as "momentumPctCached",
      ${from}::timestamp as "windowStart",
      ${now}::timestamp as "windowEnd",
      ${now}::timestamp as "updatedAt"
    ON CONFLICT ("groupId") DO UPDATE SET
      "totalScored" = EXCLUDED."totalScored",
      "correctScored" = EXCLUDED."correctScored",
      "memberCountSnapshot" = EXCLUDED."memberCountSnapshot",
      "momentumPctCached" = EXCLUDED."momentumPctCached",
      "windowStart" = EXCLUDED."windowStart",
      "windowEnd" = EXCLUDED."windowEnd",
      "updatedAt" = EXCLUDED."updatedAt";
  `;

  return { ok: true as const, windowDays };
}

export async function recomputeUserPredictionStatsAggregate(userId: string) {
  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Compute correctness + points in SQL (tiered_v1 model).
  // Points model:
  // - exact: 15
  // - wrong winner: 0
  // - correct winner: 10/8/6/5 depending on goal error 1/2/3/>=4
  await prisma.$executeRaw`
    WITH scored AS (
      SELECT
        p."userId" as "userId",
        COUNT(*)::int as total,
        SUM(
          CASE
            WHEN (p."homeScore" = r."homeScore" AND p."awayScore" = r."awayScore") THEN 15
            WHEN (
              (CASE WHEN p."homeScore" = p."awayScore" THEN 'DRAW' WHEN p."homeScore" > p."awayScore" THEN 'HOME' ELSE 'AWAY' END)
              <> (CASE WHEN r."homeScore" = r."awayScore" THEN 'DRAW' WHEN r."homeScore" > r."awayScore" THEN 'HOME' ELSE 'AWAY' END)
            ) THEN 0
            ELSE
              CASE
                WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 1 THEN 10
                WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 2 THEN 8
                WHEN (ABS(p."homeScore" - r."homeScore") + ABS(p."awayScore" - r."awayScore")) = 3 THEN 6
                ELSE 5
              END
          END
        )::int as points,
        SUM(
          CASE
            WHEN (
              (CASE WHEN p."homeScore" = p."awayScore" THEN 'DRAW' WHEN p."homeScore" > p."awayScore" THEN 'HOME' ELSE 'AWAY' END)
              = (CASE WHEN r."homeScore" = r."awayScore" THEN 'DRAW' WHEN r."homeScore" > r."awayScore" THEN 'HOME' ELSE 'AWAY' END)
            ) THEN 1
            ELSE 0
          END
        )::int as correct
      FROM "Prediction" p
      JOIN "Match" m ON m."id" = p."matchId"
      JOIN "MatchResult" r ON r."matchId" = m."id"
      WHERE p."userId" = ${userId}
        AND m."status" = 'FINISHED'
      GROUP BY p."userId"
    ),
    scored30 AS (
      SELECT
        p."userId" as "userId",
        COUNT(*)::int as total30,
        SUM(
          CASE
            WHEN (
              (CASE WHEN p."homeScore" = p."awayScore" THEN 'DRAW' WHEN p."homeScore" > p."awayScore" THEN 'HOME' ELSE 'AWAY' END)
              = (CASE WHEN r."homeScore" = r."awayScore" THEN 'DRAW' WHEN r."homeScore" > r."awayScore" THEN 'HOME' ELSE 'AWAY' END)
            ) THEN 1
            ELSE 0
          END
        )::int as correct30
      FROM "Prediction" p
      JOIN "Match" m ON m."id" = p."matchId"
      JOIN "MatchResult" r ON r."matchId" = m."id"
      WHERE p."userId" = ${userId}
        AND m."status" = 'FINISHED'
        AND COALESCE(m."finalizedAt", m."kickoffAt") >= ${from30}
      GROUP BY p."userId"
    )
    INSERT INTO "UserPredictionStatsAggregate" (
      "id",
      "userId",
      "lifetimeTotal",
      "lifetimeCorrect",
      "lifetimePoints",
      "avgPoints",
      "recent30dTotal",
      "recent30dCorrect",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text as "id",
      ${userId}::text as "userId",
      COALESCE(scored.total, 0) as "lifetimeTotal",
      COALESCE(scored.correct, 0) as "lifetimeCorrect",
      COALESCE(scored.points, 0) as "lifetimePoints",
      CASE WHEN COALESCE(scored.total, 0) = 0 THEN 0 ELSE (COALESCE(scored.points, 0)::float / scored.total::float) END as "avgPoints",
      COALESCE(scored30.total30, 0) as "recent30dTotal",
      COALESCE(scored30.correct30, 0) as "recent30dCorrect",
      ${now}::timestamp as "updatedAt"
    FROM (SELECT 1) x
    LEFT JOIN scored ON true
    LEFT JOIN scored30 ON true
    ON CONFLICT ("userId") DO UPDATE SET
      "lifetimeTotal" = EXCLUDED."lifetimeTotal",
      "lifetimeCorrect" = EXCLUDED."lifetimeCorrect",
      "lifetimePoints" = EXCLUDED."lifetimePoints",
      "avgPoints" = EXCLUDED."avgPoints",
      "recent30dTotal" = EXCLUDED."recent30dTotal",
      "recent30dCorrect" = EXCLUDED."recent30dCorrect",
      "updatedAt" = EXCLUDED."updatedAt";
  `;

  return { ok: true as const };
}

export async function recomputeAllGroupAggregates(opts?: { batchSize?: number }) {
  const batchSize = opts?.batchSize ?? 25;

  const groups = await prisma.group.findMany({ select: { id: true } });

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < groups.length; i += batchSize) {
    const batch = groups.slice(i, i + batchSize);

    // Keep it sequential within the batch to avoid connection spikes.
    for (const g of batch) {
      try {
        await recomputeGroupMemberAccuracyAggregate(g.id);
        await recomputeGroupMomentumAggregate(g.id);
        ok++;
      } catch (e) {
        console.error("[aggregates] group recompute failed", g.id, e);
        fail++;
      }
    }
  }

  return { ok: true as const, groups: groups.length, success: ok, failed: fail };
}

export async function recomputeAllUserAggregates(opts?: { batchSize?: number }) {
  const batchSize = opts?.batchSize ?? 50;

  const users = await prisma.user.findMany({ select: { id: true } });

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    for (const u of batch) {
      try {
        await recomputeUserPredictionStatsAggregate(u.id);
        ok++;
      } catch (e) {
        console.error("[aggregates] user recompute failed", u.id, e);
        fail++;
      }
    }
  }

  return { ok: true as const, users: users.length, success: ok, failed: fail };
}
