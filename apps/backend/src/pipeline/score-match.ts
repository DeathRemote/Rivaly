import { MatchStatus, PointsEventType, Prisma, Provider } from "@prisma/client";

import { prisma } from "../prisma.js";
import { scorePredictionPoints } from "../scoring/predictions.js";
import { uuid } from "../jobs/support/id.js";

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

    // Apply deltas only for newly inserted events (idempotent).
    if (inserted.length > 0) {
      const gIds = inserted.map((r) => r.groupId);
      const uIds = inserted.map((r) => r.userId);
      const pts = inserted.map((r) => r.points);

      await tx.$executeRaw(Prisma.sql`
        WITH delta AS (
          SELECT "groupId", "userId", SUM("points")::int AS points
          FROM UNNEST(
            ${gIds}::text[],
            ${uIds}::text[],
            ${pts}::int[]
          ) AS t("groupId", "userId", "points")
          GROUP BY "groupId", "userId"
        )
        UPDATE "GroupMember" gm
        SET "points" = gm."points" + delta.points
        FROM delta
        WHERE gm."groupId" = delta."groupId" AND gm."userId" = delta."userId";
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
