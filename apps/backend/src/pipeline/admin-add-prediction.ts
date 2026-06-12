import { Prisma } from "@prisma/client";

import { prisma } from "../prisma.js";
import { scorePredictionPoints } from "../scoring/predictions.js";
import { uuid } from "../jobs/support/id.js";

/**
 * Admin override: upsert a user's prediction even after lock.
 * If the match already has a persisted result, also score it and update points/aggregates.
 *
 * Notes:
 * - Points are idempotent via unique constraints on SeasonPointsEvent and PointsEvent.
 * - Uses raw SQL for SeasonPointsEvent/SeasonUserPoints since backend Prisma schema may lag.
 */
export async function adminUpsertPredictionAndScore(opts: {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  scoreIfPossible?: boolean;
  // If true and already scored, override (delete + rescore) the user's points for this match.
  forceRescore?: boolean;
}) {
  const scoreIfPossible = opts.scoreIfPossible ?? true;
  const forceRescore = opts.forceRescore ?? false;

  const match = await prisma.match.findUnique({
    where: { id: opts.matchId },
    select: {
      id: true,
      competitionSeasonId: true,
      result: { select: { homeScore: true, awayScore: true } },
    },
  });

  if (!match) throw new Error(`MATCH_NOT_FOUND:${opts.matchId}`);

  // 1) Upsert the prediction regardless of lock window.
  await prisma.prediction.upsert({
    where: { userId_matchId: { userId: opts.userId, matchId: opts.matchId } },
    create: {
      userId: opts.userId,
      matchId: opts.matchId,
      homeScore: opts.homeScore,
      awayScore: opts.awayScore,
      source: "SCORE",
    },
    update: {
      homeScore: opts.homeScore,
      awayScore: opts.awayScore,
      source: "SCORE",
    },
  });

  if (!scoreIfPossible) {
    return { ok: true as const, predictionSaved: true as const, scored: false as const, reason: "Scoring skipped" };
  }

  if (!match.result) {
    return {
      ok: true as const,
      predictionSaved: true as const,
      scored: false as const,
      reason: "Match has no persisted result yet",
    };
  }

  if (!match.competitionSeasonId) {
    return {
      ok: true as const,
      predictionSaved: true as const,
      scored: false as const,
      reason: "Match missing competitionSeasonId",
    };
  }

  const actual = { home: match.result.homeScore, away: match.result.awayScore };
  const predicted = { home: opts.homeScore, away: opts.awayScore };
  const scored = scorePredictionPoints({ predicted, actual });

  // Groups this user belongs to (classic scoring) in this season.
  const groupIdsRows = await prisma.$queryRaw<Array<{ groupId: string }>>(Prisma.sql`
    SELECT gm."groupId" as "groupId"
    FROM "GroupMember" gm
    JOIN "Group" g ON g."id" = gm."groupId"
    WHERE gm."userId" = ${opts.userId}
      AND g."competitionSeasonId" = ${match.competitionSeasonId}
      AND g."scoringSystem" = 'CLASSIC'::"ScoringSystem";
  `);

  const groupIds = groupIdsRows.map((r) => r.groupId);

  // 2) Score + write points (idempotent by default; forceRescore enables override)
  const txOut = await prisma.$transaction(async (tx) => {
    // If requested, remove the prior scored event so we can re-score.
    // (We keep Prediction history via updatedAt; points history is effectively replaced.)
    let seasonDeleted = 0;
    let groupDeleted = 0;

    if (forceRescore) {
      const delSeason = await tx.$executeRaw(Prisma.sql`
        DELETE FROM "SeasonPointsEvent"
        WHERE "competitionSeasonId" = ${match.competitionSeasonId}::text
          AND "scoringSystem" = 'CLASSIC'::"ScoringSystem"
          AND "userId" = ${opts.userId}::text
          AND "matchId" = ${match.id}::text
          AND "type" = 'PREDICTION_SCORED'::"SeasonPointsEventType";
      `);
      seasonDeleted = Number(delSeason) || 0;

      if (groupIds.length) {
        const delGroup = await tx.$executeRaw(Prisma.sql`
          DELETE FROM "PointsEvent"
          WHERE "groupId" IN (${Prisma.join(groupIds.map((g) => Prisma.sql`${g}::text`))})
            AND "userId" = ${opts.userId}::text
            AND "matchId" = ${match.id}::text
            AND "type" = 'PREDICTION_SCORED'::"PointsEventType";
        `);
        groupDeleted = Number(delGroup) || 0;
      }
    }

    // Insert canonical SeasonPointsEvent ONCE per user+match.
    const seasonEventRows = await tx.$queryRaw<Array<{ points: number }>>(Prisma.sql`
      INSERT INTO "SeasonPointsEvent" (
        "id",
        "competitionSeasonId",
        "scoringSystem",
        "userId",
        "matchId",
        "type",
        "points",
        "reason",
        "meta",
        "createdAt"
      )
      VALUES (
        ${uuid()}::text,
        ${match.competitionSeasonId}::text,
        'CLASSIC'::"ScoringSystem",
        ${opts.userId}::text,
        ${match.id}::text,
        'PREDICTION_SCORED'::"SeasonPointsEventType",
        ${scored.points}::int,
        ${scored.reason}::text,
        ${JSON.stringify(scored.meta)}::jsonb,
        NOW()
      )
      ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId", "matchId", "type") DO NOTHING
      RETURNING "points";
    `);

    const seasonInserted = seasonEventRows.length > 0;

    // Recompute SeasonUserPoints from the ledger (avoids drift when force-rescoring).
    const totalRows = await tx.$queryRaw<Array<{ total: number | null }>>(Prisma.sql`
      SELECT COALESCE(SUM("points"), 0) as "total"
      FROM "SeasonPointsEvent"
      WHERE "competitionSeasonId" = ${match.competitionSeasonId}::text
        AND "scoringSystem" = 'CLASSIC'::"ScoringSystem"
        AND "userId" = ${opts.userId}::text;
    `);

    const newSeasonTotal = totalRows[0]?.total ?? 0;

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SeasonUserPoints" (
        "id",
        "competitionSeasonId",
        "scoringSystem",
        "userId",
        "points",
        "updatedAt"
      )
      VALUES (
        ${uuid()}::text,
        ${match.competitionSeasonId}::text,
        'CLASSIC'::"ScoringSystem",
        ${opts.userId}::text,
        ${newSeasonTotal}::int,
        NOW()
      )
      ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId")
      DO UPDATE SET "points" = EXCLUDED."points", "updatedAt" = NOW();
    `);

    // Insert group PointsEvents (one per group membership).
    let groupEventsInserted = 0;
    for (const gid of groupIds) {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "PointsEvent" (
          "id",
          "type",
          "groupId",
          "userId",
          "matchId",
          "points",
          "reason",
          "meta",
          "createdAt"
        )
        VALUES (
          ${uuid()}::text,
          'PREDICTION_SCORED'::"PointsEventType",
          ${gid}::text,
          ${opts.userId}::text,
          ${match.id}::text,
          ${scored.points}::int,
          ${scored.reason}::text,
          ${JSON.stringify(scored.meta)}::jsonb,
          NOW()
        )
        ON CONFLICT ("groupId", "userId", "matchId", "type") DO NOTHING
        RETURNING "id";
      `);

      if (inserted.length) groupEventsInserted++;
    }

    // Sync GroupMember.points from SeasonUserPoints (for this user only).
    await tx.$executeRaw(Prisma.sql`
      UPDATE "GroupMember" gm
      SET "points" = sup."points"
      FROM "Group" g
      JOIN "SeasonUserPoints" sup
        ON sup."competitionSeasonId" = g."competitionSeasonId"
       AND sup."scoringSystem" = g."scoringSystem"
      WHERE gm."groupId" = g."id"
        AND sup."userId" = gm."userId"
        AND g."competitionSeasonId" = ${match.competitionSeasonId}
        AND g."scoringSystem" = 'CLASSIC'::"ScoringSystem"
        AND gm."userId" = ${opts.userId};
    `);

    return { seasonInserted, groupEventsInserted, seasonDeleted, groupDeleted, newSeasonTotal };
  });

  return {
    ok: true as const,
    predictionSaved: true as const,
    scored: true as const,
    points: scored.points,
    reason: scored.reason,
    meta: scored.meta,
    seasonEventInserted: txOut.seasonInserted,
    groupEventsInserted: txOut.groupEventsInserted,
    seasonEventDeleted: (txOut as any).seasonDeleted ?? 0,
    groupEventsDeleted: (txOut as any).groupDeleted ?? 0,
    newSeasonTotal: (txOut as any).newSeasonTotal ?? null,
    affectedGroupIds: groupIds,
    affectedUserIds: [opts.userId],
  };
}
