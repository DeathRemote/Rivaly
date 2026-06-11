import { MatchStatus, PointsEventType, Prisma, Provider } from "@prisma/client";

import { prisma } from "../prisma.js";
import { scorePredictionPoints } from "../scoring/predictions.js";
import { uuid } from "../jobs/support/id.js";
import { advisoryXactLock } from "./locks.js";

export type ScoreMatchPayload = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  providerEventId?: string | null;
};

export async function scoreMatch(payload: ScoreMatchPayload) {
  const match = await prisma.match.findUnique({
    where: { id: payload.matchId },
    select: {
      id: true,
      competitionSeasonId: true,
      competitionSeason: { select: { provider: true } },
      provider: true,
    },
  });

  if (!match) throw new Error(`Match not found: ${payload.matchId}`);

  const out = await prisma.$transaction(async (tx) => {
    // Prevent concurrent scoring of the same match across worker instances.
    await advisoryXactLock(tx, `score-match:${payload.matchId}`);
    await tx.match.update({
      where: { id: payload.matchId },
      data: {
        status: MatchStatus.FINISHED,
        finalizedAt: new Date(),
      },
    });

    await tx.matchResult.upsert({
      where: { matchId: payload.matchId },
      create: {
        matchId: payload.matchId,
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        provider: Provider.THESPORTSDB,
        providerEventId: payload.providerEventId ?? null,
      },
      update: {
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        providerEventId: payload.providerEventId ?? null,
      },
    });

    const predictions = await tx.prediction.findMany({
      where: { matchId: payload.matchId },
      select: { userId: true, homeScore: true, awayScore: true },
    });

    const predictedUserIds = predictions.map((p) => p.userId);
    const predictionByUserId = new Map<string, (typeof predictions)[number]>(
      predictions.map((p) => [p.userId, p] as const),
    );

    const groups = await tx.group.findMany({
      where: { competitionSeasonId: match.competitionSeasonId },
      select: { id: true },
    });

    const groupIds = groups.map((g) => g.id);

    const eligibleMembers =
      groupIds.length === 0 || predictedUserIds.length === 0
        ? []
        : await tx.groupMember.findMany({
            where: {
              groupId: { in: groupIds },
              userId: { in: predictedUserIds },
            },
            select: { groupId: true, userId: true },
          });

    if (eligibleMembers.length === 0) {
      await tx.match.update({
        where: { id: payload.matchId },
        data: { processedAt: new Date() },
      });

      return {
        insertedEvents: 0,
        affectedGroupIds: [] as string[],
        affectedUserIds: [] as string[],
      };
    }

    const ids: string[] = [];
    const types: string[] = [];
    const groupIdArr: string[] = [];
    const userIdArr: string[] = [];
    const matchIdArr: string[] = [];
    const pointsArr: number[] = [];
    const reasonArr: (string | null)[] = [];
    const metaArr: any[] = [];
    const createdAtArr: Date[] = [];

    const affectedGroupIds = new Set<string>();
    const affectedUserIds = new Set<string>();

    for (const mbr of eligibleMembers) {
      const p = predictionByUserId.get(mbr.userId);
      if (!p) continue;

      const scored = scorePredictionPoints({
        predicted: { home: p.homeScore, away: p.awayScore },
        actual: { home: payload.homeScore, away: payload.awayScore },
      });

      affectedGroupIds.add(mbr.groupId);
      affectedUserIds.add(mbr.userId);

      ids.push(uuid());
      types.push(PointsEventType.PREDICTION_SCORED);
      groupIdArr.push(mbr.groupId);
      userIdArr.push(mbr.userId);
      matchIdArr.push(payload.matchId);
      pointsArr.push(scored.points);
      reasonArr.push(scored.reason ?? null);
      metaArr.push(scored.meta ?? null);
      createdAtArr.push(new Date());
    }

    // Insert points events idempotently WITHOUT throwing.
    // We use ON CONFLICT DO NOTHING so a duplicate never aborts the transaction.
    const inserted = await tx.$queryRaw<
      Array<{ groupId: string; userId: string; points: number }>
    >(Prisma.sql`
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
      SELECT * FROM UNNEST(
        ${ids}::text[],
        ${types}::"PointsEventType"[],
        ${groupIdArr}::text[],
        ${userIdArr}::text[],
        ${matchIdArr}::text[],
        ${pointsArr}::int[],
        ${reasonArr}::text[],
        ${metaArr}::jsonb[],
        ${createdAtArr}::timestamptz[]
      )
      ON CONFLICT ("groupId", "userId", "matchId", "type") DO NOTHING
      RETURNING "groupId", "userId", "points";
    `);

    // Canonical season scoring: insert ONE season event per user+match.
    // (A user might be in multiple groups for the season; we must not double-score.)
    if (match.competitionSeasonId && inserted.length > 0) {
      // Dedup per user (use inserted since it's already derived from eligible members).
      const byUser = new Map<string, { userId: string; points: number }>();
      for (const row of inserted) {
        if (!byUser.has(row.userId)) byUser.set(row.userId, { userId: row.userId, points: row.points });
      }

      const userIdsUniq = Array.from(byUser.values()).map((r) => r.userId);
      const pointsUniq = Array.from(byUser.values()).map((r) => r.points);
      const idsUniq = userIdsUniq.map(() => uuid());
      const createdAt = userIdsUniq.map(() => new Date());

      const seasonIds = userIdsUniq.map(() => match.competitionSeasonId as string);
      const scoringSystems = userIdsUniq.map(() => "CLASSIC");
      const matchIds = userIdsUniq.map(() => payload.matchId);
      const typesUniq = userIdsUniq.map(() => "PREDICTION_SCORED");

      const seasonInserted = await tx.$queryRaw<Array<{ userId: string; points: number }>>(Prisma.sql`
        INSERT INTO "SeasonPointsEvent" (
          "id",
          "competitionSeasonId",
          "scoringSystem",
          "userId",
          "matchId",
          "type",
          "points",
          "createdAt"
        )
        SELECT * FROM UNNEST(
          ${idsUniq}::text[],
          ${seasonIds}::text[],
          ${scoringSystems}::"ScoringSystem"[],
          ${userIdsUniq}::text[],
          ${matchIds}::text[],
          ${typesUniq}::"SeasonPointsEventType"[],
          ${pointsUniq}::int[],
          ${createdAt}::timestamptz[]
        )
        ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId", "matchId", "type") DO NOTHING
        RETURNING "userId", "points";
      `);

      if (seasonInserted.length > 0) {
        const uIds = seasonInserted.map((r) => r.userId);
        const pts = seasonInserted.map((r) => r.points);
        const rowIds = uIds.map(() => uuid());
        const seasonArr = uIds.map(() => match.competitionSeasonId as string);
        const ssArr = uIds.map(() => "CLASSIC");
        const updatedAtArr = uIds.map(() => new Date());

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "SeasonUserPoints" (
            "id",
            "competitionSeasonId",
            "scoringSystem",
            "userId",
            "points",
            "updatedAt"
          )
          SELECT * FROM UNNEST(
            ${rowIds}::text[],
            ${seasonArr}::text[],
            ${ssArr}::"ScoringSystem"[],
            ${uIds}::text[],
            ${pts}::int[],
            ${updatedAtArr}::timestamptz[]
          )
          ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId")
          DO UPDATE SET "points" = "SeasonUserPoints"."points" + EXCLUDED."points", "updatedAt" = NOW();
        `);
      }

      // Sync all classic groups' GroupMember.points to the canonical SeasonUserPoints.
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
          AND gm."userId" IN (${Prisma.join(userIdsUniq)});
      `);
    }

    await tx.match.update({
      where: { id: payload.matchId },
      data: { processedAt: new Date() },
    });

    return {
      insertedEvents: inserted.length,
      affectedGroupIds: Array.from(affectedGroupIds),
      affectedUserIds: Array.from(affectedUserIds),
    };
  });

  return out;
}
