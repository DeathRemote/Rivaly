import { MatchStatus, PointsEventType, Prisma, Provider } from "@prisma/client";

import { prisma } from "../prisma.js";
import { TheSportsDbClient } from "../providers/thesportsdb/client.js";
import { scoreKnockoutPredictionPoints, scorePredictionPoints } from "../scoring/predictions.js";
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
      providerMatchId: true,
      knockoutRound: true,
      competitionPhase: { select: { type: true } },
      homeTeamId: true,
      awayTeamId: true,
      result: { select: { advancesTeamId: true } },
    },
  });

  if (!match) throw new Error(`Match not found: ${payload.matchId}`);

  // Knockout draw handling: if the match ended in a draw, we need to know who advanced (penalties/ET).
  // We try to resolve advancesTeamId from (in order):
  // 1) existing MatchResult.advancesTeamId (admin override),
  // 2) provider payload (TheSportsDB strResult),
  // 3) otherwise we delay scoring and retry later.
  const isKnockout = match.knockoutRound != null || match.competitionPhase?.type === "KNOCKOUT";

  let resolvedAdvancesTeamId: string | null = match.result?.advancesTeamId ?? null;

  if (isKnockout && payload.homeScore === payload.awayScore && !resolvedAdvancesTeamId) {
    const providerEventId = payload.providerEventId ?? match.providerMatchId ?? null;

    if (providerEventId && match.provider === Provider.THESPORTSDB) {
      try {
        const client = new TheSportsDbClient();
        const evt = await client.lookupEvent(String(providerEventId));
        const r = (evt?.strResult ?? "").trim();

        // Observed formats:
        // - "England Win 5-3 on penalties after extra time."
        // - "Portugal win 3-0 on pens"
        const mWinner = r.match(/^(.+?)\s+win\b/i);
        const winnerName = mWinner?.[1]?.trim() ?? null;

        if (winnerName) {
          const w = winnerName.toLowerCase();
          const home = (evt?.strHomeTeam ?? "").toLowerCase();
          const away = (evt?.strAwayTeam ?? "").toLowerCase();

          if (w === home) resolvedAdvancesTeamId = match.homeTeamId;
          else if (w === away) resolvedAdvancesTeamId = match.awayTeamId;
        }
      } catch (err) {
        console.warn("[score-match] provider lookup failed for advancesTeamId", err);
      }
    }
  }

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
        advancesTeamId: isKnockout && payload.homeScore === payload.awayScore ? resolvedAdvancesTeamId : null,
        provider: Provider.THESPORTSDB,
        providerEventId: payload.providerEventId ?? null,
      },
      update: {
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        advancesTeamId: isKnockout && payload.homeScore === payload.awayScore ? resolvedAdvancesTeamId : null,
        providerEventId: payload.providerEventId ?? null,
      },
    });

    const awaitingAdvancesBonus =
      isKnockout && payload.homeScore === payload.awayScore && !resolvedAdvancesTeamId;

    const predictions = await tx.prediction.findMany({
      where: { matchId: payload.matchId },
      select: { userId: true, homeScore: true, awayScore: true, advancesTeamId: true },
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

      if (isKnockout) {
        const scored = scoreKnockoutPredictionPoints({
          predicted: { home: p.homeScore, away: p.awayScore },
          actual: { home: payload.homeScore, away: payload.awayScore },
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          predictedAdvancesTeamId: p.advancesTeamId,
          actualAdvancesTeamId: resolvedAdvancesTeamId,
        });

        affectedGroupIds.add(mbr.groupId);
        affectedUserIds.add(mbr.userId);

        // Base event (always)
        ids.push(uuid());
        types.push(PointsEventType.PREDICTION_SCORED);
        groupIdArr.push(mbr.groupId);
        userIdArr.push(mbr.userId);
        matchIdArr.push(payload.matchId);
        pointsArr.push(scored.basePoints);
        reasonArr.push(scored.baseReason ?? null);
        metaArr.push(scored.meta ?? null);
        createdAtArr.push(new Date());

        // Bonus event (only when known + eligible)
        if (scored.bonusPoints > 0) {
          ids.push(uuid());
          types.push(PointsEventType.PREDICTION_ADVANCES_BONUS);
          groupIdArr.push(mbr.groupId);
          userIdArr.push(mbr.userId);
          matchIdArr.push(payload.matchId);
          pointsArr.push(scored.bonusPoints);
          reasonArr.push(scored.bonusReason ?? null);
          metaArr.push(scored.meta ?? null);
          createdAtArr.push(new Date());
        }
      } else {
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
    }

    // Insert points events idempotently WITHOUT throwing.
    // We use ON CONFLICT DO NOTHING so a duplicate never aborts the transaction.
    const inserted = await tx.$queryRaw<
      Array<{ groupId: string; userId: string; points: number; type: PointsEventType }>
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
      RETURNING "groupId", "userId", "points", "type";
    `);

    // Canonical season scoring: insert ONE season event per user+match.
    // (A user might be in multiple groups for the season; we must not double-score.)
    if (match.competitionSeasonId && inserted.length > 0) {
      // Canonical season scoring: insert ONE season event per user+match+type.
      // (A user might be in multiple groups for the season; we must not double-score.)
      const byUserType = new Map<string, { userId: string; type: "PREDICTION_SCORED" | "PREDICTION_ADVANCES_BONUS"; points: number }>();

      for (const row of inserted) {
        const type =
          row.type === PointsEventType.PREDICTION_ADVANCES_BONUS
            ? ("PREDICTION_ADVANCES_BONUS" as const)
            : ("PREDICTION_SCORED" as const);

        const key = `${row.userId}:${type}`;
        // inserted can contain duplicates across groups; keep the first (points are identical)
        if (!byUserType.has(key)) byUserType.set(key, { userId: row.userId, type, points: row.points });
      }

      const seasonRows = Array.from(byUserType.values());
      const userIdsUniq = seasonRows.map((r) => r.userId);
      const pointsUniq = seasonRows.map((r) => r.points);
      const typesUniq = seasonRows.map((r) => r.type);

      const idsUniq = seasonRows.map(() => uuid());
      const createdAt = seasonRows.map(() => new Date());
      const seasonIds = seasonRows.map(() => match.competitionSeasonId as string);
      const scoringSystems = seasonRows.map(() => "CLASSIC");
      const matchIds = seasonRows.map(() => payload.matchId);

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
        const byUser = new Map<string, number>();
        for (const r of seasonInserted) byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + r.points);

        const uIds = Array.from(byUser.keys());
        const pts = uIds.map((id) => byUser.get(id) ?? 0);

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

    // If we are awaiting the penalty winner, we STILL score the base draw points now,
    // but we do NOT mark processedAt yet so the scheduler keeps revisiting this match.
    if (!awaitingAdvancesBonus) {
      await tx.match.update({
        where: { id: payload.matchId },
        data: { processedAt: new Date() },
      });
    }

    return {
      insertedEvents: inserted.length,
      affectedGroupIds: Array.from(affectedGroupIds),
      affectedUserIds: Array.from(affectedUserIds),
      awaitingAdvancesBonus,
    };
  });

  return out;
}
