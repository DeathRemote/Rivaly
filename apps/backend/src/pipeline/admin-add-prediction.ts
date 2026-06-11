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
}) {
  const scoreIfPossible = opts.scoreIfPossible ?? true;

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

  // 2) Score + write points (idempotent)
  const txOut = await prisma.$transaction(async (tx) => {
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

    if (seasonInserted) {
      // Increment SeasonUserPoints.
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
          ${scored.points}::int,
          NOW()
        )
        ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId")
        DO UPDATE SET "points" = "SeasonUserPoints"."points" + EXCLUDED."points", "updatedAt" = NOW();
      `);
    }

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

    return { seasonInserted, groupEventsInserted };
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
    affectedGroupIds: groupIds,
    affectedUserIds: [opts.userId],
  };
}
