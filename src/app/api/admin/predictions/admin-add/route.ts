import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";
import { scoreKnockoutPredictionPoints, scorePredictionPoints } from "@/lib/scoring/predictions";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "@/lib/aggregates/recompute";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = z
    .object({
      userId: z.string().min(1),
      matchId: z.string().min(1),
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
      scoreIfPossible: z.boolean().optional().default(true),
      // For knockout draws decided on penalties.
      predictedAdvancesTeamId: z.string().min(1).optional().nullable(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }

  const { userId, matchId, homeScore, awayScore, scoreIfPossible, predictedAdvancesTeamId } = parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      competitionSeasonId: true,
      knockoutRound: true,
      homeTeamId: true,
      awayTeamId: true,
      result: { select: { homeScore: true, awayScore: true, advancesTeamId: true } },
    },
  });

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });

  // Always allow the admin to upsert the prediction.
  await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId } },
    create: { userId, matchId, homeScore, awayScore, advancesTeamId: predictedAdvancesTeamId ?? null, source: "SCORE" },
    update: { homeScore, awayScore, advancesTeamId: predictedAdvancesTeamId ?? null, source: "SCORE" },
  });

  if (!scoreIfPossible) {
    return NextResponse.json({ ok: true, saved: true, scored: false, reason: "Scoring skipped" });
  }

  if (!match.result) {
    return NextResponse.json({ ok: true, saved: true, scored: false, reason: "Match has no result yet" });
  }

  if (!match.competitionSeasonId) {
    return NextResponse.json({ ok: true, saved: true, scored: false, reason: "Match has no competitionSeasonId" });
  }

  const actual = { home: match.result.homeScore, away: match.result.awayScore };
  const predicted = { home: homeScore, away: awayScore };

  const isKnockout = match.knockoutRound != null;
  const scored = isKnockout
    ? scoreKnockoutPredictionPoints({
        predicted,
        actual,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        predictedAdvancesTeamId: predictedAdvancesTeamId ?? null,
        actualAdvancesTeamId: match.result.advancesTeamId,
      })
    : scorePredictionPoints({ predicted, actual });

  // Compute eligible groups (classic scoring system) where this user is a member.
  const eligibleMembers = await prisma.groupMember.findMany({
    where: {
      userId,
      group: { competitionSeasonId: match.competitionSeasonId, scoringSystem: "CLASSIC" },
    },
    select: { groupId: true },
  });
  const groupIds = Array.from(new Set(eligibleMembers.map((m) => m.groupId)));

  // Transaction: write canonical season scoring once; mirror points into group events; sync GroupMember points.
  const txOut = await prisma.$transaction(async (tx) => {
    let seasonEventInserted = false;

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
      seasonEventInserted = true;

      await tx.seasonUserPoints.upsert({
        where: {
          competitionSeasonId_scoringSystem_userId: {
            competitionSeasonId: match.competitionSeasonId!,
            scoringSystem: "CLASSIC",
            userId,
          },
        },
        create: {
          competitionSeasonId: match.competitionSeasonId!,
          scoringSystem: "CLASSIC",
          userId,
          points: scored.points,
        },
        update: { points: { increment: scored.points } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // already scored for this user+match
      } else {
        throw err;
      }
    }

    let groupEventsInserted = 0;
    for (const gid of groupIds) {
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
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // already exists
        } else {
          throw err;
        }
      }
    }

    // Sync GroupMember points from canonical season points.
    if (groupIds.length) {
      const sup = await tx.seasonUserPoints.findUnique({
        where: {
          competitionSeasonId_scoringSystem_userId: {
            competitionSeasonId: match.competitionSeasonId!,
            scoringSystem: "CLASSIC",
            userId,
          },
        },
        select: { points: true },
      });

      await tx.groupMember.updateMany({
        where: { userId, groupId: { in: groupIds } },
        data: { points: sup?.points ?? 0 },
      });
    }

    return { seasonEventInserted, groupEventsInserted };
  });

  // Best-effort: recompute aggregates + standings.
  try {
    for (const gid of groupIds) {
      await recomputeGroupMemberAccuracyAggregate(gid);
      await recomputeGroupMomentumAggregate(gid);
    }
    await recomputeUserPredictionStatsAggregate(userId);
  } catch (err) {
    console.warn("[admin-add-prediction] aggregates recompute failed", err);
  }

  try {
    await syncCompetitionSeasonStandings({ competitionSeasonId: match.competitionSeasonId });
  } catch (err) {
    console.warn("[admin-add-prediction] standings sync failed", err);
  }

  return NextResponse.json({
    ok: true,
    saved: true,
    scored: true,
    points: scored.points,
    reason: scored.reason,
    meta: scored.meta,
    groupIds,
    tx: txOut,
  });
}
