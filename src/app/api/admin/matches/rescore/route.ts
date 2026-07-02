import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";
import { scoreKnockoutPredictionPoints, scorePredictionPoints } from "@/lib/scoring/predictions";

const BodySchema = z.object({
  matchId: z.string().min(1),
  forceRescore: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

  const { matchId, forceRescore } = body.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      processedAt: true,
      competitionSeasonId: true,
      knockoutRound: true,
      homeTeamId: true,
      awayTeamId: true,
      result: { select: { homeScore: true, awayScore: true, advancesTeamId: true } },
    },
  });

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
  if (!match.competitionSeasonId) {
    return NextResponse.json({ ok: false, error: "Match has no competitionSeasonId" }, { status: 409 });
  }
  if (!match.result) {
    return NextResponse.json({ ok: false, error: "Match has no result yet" }, { status: 409 });
  }

  const actual = { home: match.result.homeScore, away: match.result.awayScore };
  const isKnockout = match.knockoutRound != null;

  // Load predictions for this match (global per user+match).
  const predictions = await prisma.prediction.findMany({
    where: { matchId: match.id },
    select: { userId: true, homeScore: true, awayScore: true, advancesTeamId: true },
  });

  const predictionByUserId = new Map<string, (typeof predictions)[number]>(
    predictions.map((p) => [p.userId, p] as const),
  );

  // Only score users who are members of classic groups for this season.
  const groups = await prisma.group.findMany({
    where: { competitionSeasonId: match.competitionSeasonId, scoringSystem: "CLASSIC" },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  const eligibleMembers =
    groupIds.length === 0 || predictions.length === 0
      ? []
      : await prisma.groupMember.findMany({
          where: {
            groupId: { in: groupIds },
            userId: { in: predictions.map((p) => p.userId) },
          },
          select: { groupId: true, userId: true },
        });

  const eligibleUserIds = Array.from(new Set(eligibleMembers.map((m) => m.userId)));

  const out = await prisma.$transaction(async (tx) => {
    if (forceRescore) {
      // Delete existing scored points for this match.
      await tx.pointsEvent.deleteMany({
        where: { matchId: match.id, type: "PREDICTION_SCORED", groupId: { in: groupIds } },
      });

      await tx.seasonPointsEvent.deleteMany({
        where: {
          competitionSeasonId: match.competitionSeasonId!,
          scoringSystem: "CLASSIC",
          matchId: match.id,
          type: "PREDICTION_SCORED",
        },
      });
    }

    let seasonEventsInserted = 0;
    let groupEventsInserted = 0;

    // Insert season events (one per user) and mirror to group events (one per group membership).
    for (const userId of eligibleUserIds) {
      const p = predictionByUserId.get(userId);
      if (!p) continue;

      const predicted = { home: p.homeScore, away: p.awayScore };

      const scored = isKnockout
        ? scoreKnockoutPredictionPoints({
            predicted,
            actual,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            predictedAdvancesTeamId: p.advancesTeamId,
            actualAdvancesTeamId: match.result!.advancesTeamId,
          })
        : scorePredictionPoints({ predicted, actual });

      // Season event (canonical)
      try {
        await tx.seasonPointsEvent.create({
          data: {
            competitionSeasonId: match.competitionSeasonId!,
            scoringSystem: "CLASSIC",
            userId,
            matchId: match.id,
            type: "PREDICTION_SCORED",
            points: scored.points,
            reason: scored.reason,
            meta: scored.meta,
          },
          select: { id: true },
        });
        seasonEventsInserted++;
      } catch {
        // ignore unique violations when not forceRescore
      }

      // Mirror to group events for this user.
      const memberGroupIds = eligibleMembers.filter((m) => m.userId === userId).map((m) => m.groupId);
      for (const gid of memberGroupIds) {
        try {
          await tx.pointsEvent.create({
            data: {
              groupId: gid,
              userId,
              matchId: match.id,
              type: "PREDICTION_SCORED",
              points: scored.points,
              reason: scored.reason,
              meta: scored.meta,
            },
            select: { id: true },
          });
          groupEventsInserted++;
        } catch {
          // ignore unique violations
        }
      }
    }

    // Recompute canonical season totals for affected users (avoid drift).
    if (eligibleUserIds.length > 0) {
      const sums = await tx.seasonPointsEvent.groupBy({
        by: ["userId"],
        where: {
          competitionSeasonId: match.competitionSeasonId!,
          scoringSystem: "CLASSIC",
          userId: { in: eligibleUserIds },
        },
        _sum: { points: true },
      });

      for (const row of sums) {
        await tx.seasonUserPoints.upsert({
          where: {
            competitionSeasonId_scoringSystem_userId: {
              competitionSeasonId: match.competitionSeasonId!,
              scoringSystem: "CLASSIC",
              userId: row.userId,
            },
          },
          create: {
            competitionSeasonId: match.competitionSeasonId!,
            scoringSystem: "CLASSIC",
            userId: row.userId,
            points: row._sum.points ?? 0,
          },
          update: { points: row._sum.points ?? 0 },
        });
      }

      // Sync GroupMember.points for all classic groups in this season.
      await tx.$executeRaw`
        UPDATE "GroupMember" gm
        SET "points" = sup."points"
        FROM "Group" g
        JOIN "SeasonUserPoints" sup
          ON sup."competitionSeasonId" = g."competitionSeasonId"
         AND sup."scoringSystem" = g."scoringSystem"
        WHERE gm."groupId" = g."id"
          AND sup."userId" = gm."userId"
          AND g."competitionSeasonId" = ${match.competitionSeasonId!}
          AND g."scoringSystem" = 'CLASSIC'
          AND gm."userId" = ANY(${eligibleUserIds});
      `;
    }

    // Mark processed so scheduler won't keep trying.
    await tx.match.update({
      where: { id: match.id },
      data: { processedAt: new Date() },
    });

    return { seasonEventsInserted, groupEventsInserted, eligibleUsers: eligibleUserIds.length };
  });

  return NextResponse.json({ ok: true, matchId: match.id, ...out });
}
