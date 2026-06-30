import { NextResponse } from "next/server";
import { z } from "zod";

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
      // If true and already scored, override (delete + rescore) the user's points for this match.
      // Use with care; intended for admin correction of mistaken predictions.
      forceRescore: z.boolean().optional().default(false),
      // For knockout draws decided on penalties.
      predictedAdvancesTeamId: z.string().min(1).optional().nullable(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }

  const { userId, matchId, homeScore, awayScore, scoreIfPossible, forceRescore, predictedAdvancesTeamId } = parsed.data;

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

  const scoredKnockout = isKnockout
    ? scoreKnockoutPredictionPoints({
        predicted,
        actual,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        predictedAdvancesTeamId: predictedAdvancesTeamId ?? null,
        actualAdvancesTeamId: match.result.advancesTeamId,
      })
    : null;

  const scored = !isKnockout
    ? scorePredictionPoints({ predicted, actual })
    : {
        points: (scoredKnockout?.basePoints ?? 0) + (scoredKnockout?.bonusPoints ?? 0),
        reason: scoredKnockout?.bonusReason ? `${scoredKnockout.baseReason}; ${scoredKnockout.bonusReason}` : (scoredKnockout?.baseReason ?? ""),
        meta: scoredKnockout?.meta ?? null,
        basePoints: scoredKnockout?.basePoints ?? 0,
        bonusPoints: scoredKnockout?.bonusPoints ?? 0,
      };

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
  // If forceRescore=true, we will delete the existing scored event (if any) and re-score with the new prediction.
  const txOut = await prisma.$transaction(async (tx) => {
    const existingSeasonEvents = await tx.seasonPointsEvent.findMany({
      where: {
        competitionSeasonId: match.competitionSeasonId!,
        scoringSystem: "CLASSIC",
        userId,
        matchId: match.id,
        type: { in: ["PREDICTION_SCORED", "PREDICTION_ADVANCES_BONUS"] },
      },
      select: { id: true, points: true, type: true },
    });

    const existingBaseSeasonEvent = existingSeasonEvents.find((e) => e.type === "PREDICTION_SCORED") ?? null;

    let seasonEventDeleted = false;
    let groupEventsDeleted = 0;

    if (existingSeasonEvents.length && forceRescore) {
      await tx.seasonPointsEvent.deleteMany({ where: { id: { in: existingSeasonEvents.map((e) => e.id) } } });
      seasonEventDeleted = true;

      if (groupIds.length) {
        const del = await tx.pointsEvent.deleteMany({
          where: {
            groupId: { in: groupIds },
            userId,
            matchId: match.id,
            type: { in: ["PREDICTION_SCORED", "PREDICTION_ADVANCES_BONUS"] },
          },
        });
        groupEventsDeleted = del.count;
      }
    }

    // Insert the canonical season event if missing (or if we just deleted it).
    let seasonEventInserted = false;
    if (!existingBaseSeasonEvent || forceRescore) {
      await tx.seasonPointsEvent.create({
        data: {
          competitionSeasonId: match.competitionSeasonId!,
          scoringSystem: "CLASSIC",
          userId,
          matchId: match.id,
          type: "PREDICTION_SCORED",
          points: scored.basePoints ?? scored.points,
          reason: scored.reason,
          meta: scored.meta,
        },
        select: { id: true },
      });
      seasonEventInserted = true;
    }

    if (isKnockout && (scored as any).bonusPoints > 0) {
      const existsBonus = existingSeasonEvents.some((e) => e.type === "PREDICTION_ADVANCES_BONUS");
      if (!existsBonus || forceRescore) {
        await tx.seasonPointsEvent.create({
          data: {
            competitionSeasonId: match.competitionSeasonId!,
            scoringSystem: "CLASSIC",
            userId,
            matchId: match.id,
            type: "PREDICTION_ADVANCES_BONUS",
            points: (scored as any).bonusPoints,
            reason: (scoredKnockout?.bonusReason ?? "Advances bonus"),
            meta: scored.meta,
          },
          select: { id: true },
        });
        seasonEventInserted = true;
      }
    }

    // Ensure SeasonUserPoints is correct by recomputing from the ledger (avoids drift).
    const sum = await tx.seasonPointsEvent.aggregate({
      where: {
        competitionSeasonId: match.competitionSeasonId!,
        scoringSystem: "CLASSIC",
        userId,
      },
      _sum: { points: true },
    });

    const newSeasonTotal = sum._sum.points ?? 0;

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
        points: newSeasonTotal,
      },
      update: { points: newSeasonTotal },
    });

    // Mirror points into group events. If not forceRescore and events already exist, we keep them.
    let groupEventsInserted = 0;
    if (!existingBaseSeasonEvent || forceRescore) {
      // Ensure we never fail on a stray pre-existing row (shouldn't happen, but safer).
      if (groupIds.length) {
        await tx.pointsEvent.deleteMany({
          where: {
            groupId: { in: groupIds },
            userId,
            matchId: match.id,
            type: { in: ["PREDICTION_SCORED", "PREDICTION_ADVANCES_BONUS"] },
          },
        });
      }

      for (const gid of groupIds) {
        await tx.pointsEvent.create({
          data: {
            groupId: gid,
            userId,
            matchId: match.id,
            type: "PREDICTION_SCORED",
            points: scored.basePoints ?? scored.points,
            reason: scored.reason,
            meta: scored.meta,
          },
          select: { id: true },
        });
        groupEventsInserted++;

        if (isKnockout && (scored as any).bonusPoints > 0) {
          await tx.pointsEvent.create({
            data: {
              groupId: gid,
              userId,
              matchId: match.id,
              type: "PREDICTION_ADVANCES_BONUS",
              points: (scored as any).bonusPoints,
              reason: scoredKnockout?.bonusReason ?? null,
              meta: scored.meta,
            },
            select: { id: true },
          });
          groupEventsInserted++;
        }
      }
    }

    // Sync GroupMember points from canonical season points.
    if (groupIds.length) {
      await tx.groupMember.updateMany({
        where: { userId, groupId: { in: groupIds } },
        data: { points: newSeasonTotal },
      });
    }

    return {
      existingSeasonPoints: existingBaseSeasonEvent?.points ?? null,
      seasonEventDeleted,
      seasonEventInserted,
      groupEventsDeleted,
      groupEventsInserted,
      newSeasonTotal,
    };
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
