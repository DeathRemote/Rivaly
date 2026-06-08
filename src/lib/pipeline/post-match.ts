import { prisma } from "@/lib/prisma";
import { Prisma, Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { scoreKnockoutPredictionPoints, scorePredictionPoints } from "@/lib/scoring/predictions";
import { computeGroupTableBonus, groupTableBonusMeta } from "@/lib/scoring/group-table-bonus";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";
import { mapTheSportsDbStatus } from "@/lib/importers/thesportsdb/map";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "@/lib/aggregates/recompute";

export async function syncAndProcessFinishedMatches(opts?: {
  maxMatches?: number;
  lookbackHours?: number;
  lookaheadMinutes?: number;
}) {
  const maxMatches = opts?.maxMatches ?? 25;

  // IMPORTANT DESIGN CHOICE:
  // Provider status can lag reality (e.g. remains "2H" after the match is actually done).
  // If we only look at a narrow kickoffAt window, we can miss scoring entirely.
  // So we primarily scan for "unprocessed" matches within a bounded recent period.
  //
  // Overrides remain for dev/tests, but defaults are chosen for reliability.
  // Provider status can lag by many hours (sometimes >24h). Default to a full 7-day window
  // so we don't miss scoring for matches that finish but get updated late.
  // Keep maxMatches bounded to avoid hammering the provider.
  const lookbackHours = opts?.lookbackHours ?? 7 * 24; // 7 days
  const lookaheadMinutes = opts?.lookaheadMinutes ?? 0; // we don't need to look ahead for finished scoring

  const now = new Date();
  const from = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

  // Candidates: unprocessed + recent-ish.
  // We do NOT filter by status here — if a match is FINISHED but unprocessed, we must still pick it up.
  // We also avoid looking too far back to prevent hammering the provider.
  const candidates = await prisma.match.findMany({
    where: {
      processedAt: null,
      provider: Provider.THESPORTSDB,
      providerMatchId: { not: null },
      kickoffAt: { gte: from, lte: to },
    },
    orderBy: { kickoffAt: "asc" },
    take: maxMatches,
    include: {
      competitionSeason: { include: { competition: true } },
    },
  });

  if (candidates.length === 0) {
    return { skipped: true as const, scanned: 0, processed: [] as const };
  }

  console.info("[post-match] candidates:", {
    scanned: candidates.length,
    from: from.toISOString(),
    to: to.toISOString(),
    maxMatches,
  });

  const client = new TheSportsDbClient();

  const processed: Array<{ matchId: string; pointsEvents: number; standingsSynced: boolean }> = [];

  for (const m of candidates) {
    const providerId = m.providerMatchId;
    if (!providerId) continue;

    const evt = await client.lookupEvent(providerId);
    if (!evt) continue;

    const mappedStatus = mapTheSportsDbStatus(evt.strStatus);

    if (mappedStatus !== "FINISHED") {
      // Update status if provider says something else.
      if (mappedStatus !== m.status) {
        await prisma.match.update({
          where: { id: m.id },
          data: { status: mappedStatus },
        });
      }
      continue;
    }

    // Finished: must have scores.
    const homeScore = evt.intHomeScore;
    const awayScore = evt.intAwayScore;
    if (typeof homeScore !== "number" || typeof awayScore !== "number") {
      // Some providers mark finished but scores missing; retry next run.
      continue;
    }

    // Knockout support: store who advanced.
    // - If match is not a draw: derive from the final score.
    // - If match is a draw: attempt to parse TheSportsDB's `strResult` (e.g. "England Win 5-3 on penalties...").
    //   If we cannot determine it reliably, leave null and score later (or via admin override).
    let advancesTeamId: string | null =
      homeScore === awayScore ? null : homeScore > awayScore ? m.homeTeamId : m.awayTeamId;

    if (advancesTeamId == null && typeof evt.strResult === "string" && evt.strResult.trim().length > 0) {
      const r = evt.strResult.trim();

      // Common format: "England Win 5-3 on penalties after extra time."
      // We'll match a leading team name and the keyword "Win".
      const mWin = r.match(/^(.+?)\s+Win\b/i);
      const winnerName = mWin?.[1]?.trim() ?? null;

      // Compare against the actual teams in this match.
      if (winnerName) {
        // TheSportsDB uses display names; exact match is usually correct for national teams.
        if (winnerName.toLowerCase() === (evt.strHomeTeam ?? "").toLowerCase()) {
          advancesTeamId = m.homeTeamId;
        } else if (winnerName.toLowerCase() === (evt.strAwayTeam ?? "").toLowerCase()) {
          advancesTeamId = m.awayTeamId;
        }
      }
    }

    // Transaction for idempotency:
    // - upsert MatchResult
    // - score predictions once via PointsEvent unique constraint
    // - update GroupMember points
    // - mark Match.processedAt
    const out = await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: m.id },
        data: { status: "FINISHED", finalizedAt: new Date() },
      });

      await tx.matchResult.upsert({
        where: { matchId: m.id },
        create: {
          matchId: m.id,
          homeScore,
          awayScore,
          advancesTeamId,
          provider: Provider.THESPORTSDB,
          providerEventId: providerId,
        },
        update: {
          homeScore,
          awayScore,
          advancesTeamId,
        },
      });

      // Load predictions for this match (global per user+match).
      const predictions = await tx.prediction.findMany({
        where: { matchId: m.id },
        select: { userId: true, homeScore: true, awayScore: true, advancesTeamId: true },
      });

      const predictedUserIds = predictions.map((p) => p.userId);
      const predictionByUserId = new Map<string, (typeof predictions)[number]>(
        predictions.map((p) => [p.userId, p] as const),
      );

      // Score ONCE per season+scoringSystem+user+match (not per group).
      // Groups with the same season+scoringSystem should display identical points.
      const groups = await tx.group.findMany({
        where: { competitionSeasonId: m.competitionSeasonId, scoringSystem: "CLASSIC" },
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

      const eligibleUserIds = Array.from(new Set(eligibleMembers.map((m) => m.userId)));

      let seasonEventsInserted = 0;
      const affectedGroupIds = new Set<string>(eligibleMembers.map((m) => m.groupId));
      const affectedUserIds = new Set<string>(eligibleUserIds);

      for (const userId of eligibleUserIds) {
        const p = predictionByUserId.get(userId);
        if (!p) continue;

        const isKnockout = m.knockoutRound != null;
        const scored = isKnockout
          ? scoreKnockoutPredictionPoints({
              predicted: { home: p.homeScore, away: p.awayScore },
              actual: { home: homeScore, away: awayScore },
              homeTeamId: m.homeTeamId,
              awayTeamId: m.awayTeamId,
              predictedAdvancesTeamId: p.advancesTeamId,
              actualAdvancesTeamId: advancesTeamId,
            })
          : scorePredictionPoints({
              predicted: { home: p.homeScore, away: p.awayScore },
              actual: { home: homeScore, away: awayScore },
            });

        try {
          const created = await tx.seasonPointsEvent.create({
            data: {
              competitionSeasonId: m.competitionSeasonId,
              scoringSystem: "CLASSIC",
              userId,
              matchId: m.id,
              type: "PREDICTION_SCORED",
              points: scored.points,
              reason: scored.reason,
              meta: scored.meta,
            },
            select: { points: true },
          });

          seasonEventsInserted++;

          await tx.seasonUserPoints.upsert({
            where: {
              competitionSeasonId_scoringSystem_userId: {
                competitionSeasonId: m.competitionSeasonId,
                scoringSystem: "CLASSIC",
                userId,
              },
            },
            create: {
              competitionSeasonId: m.competitionSeasonId,
              scoringSystem: "CLASSIC",
              userId,
              points: created.points,
            },
            update: { points: { increment: created.points } },
            select: { id: true },
          });
        } catch (err) {
          // Unique constraint => already scored.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // no-op
          } else {
            throw err;
          }
        }
      }

      // Also write per-group PointsEvent entries for aggregates (accuracy/momentum, etc).
      // This is idempotent by PointsEvent unique constraint (groupId,userId,matchId,type).
      // IMPORTANT: do NOT increment GroupMember.points from PointsEvent; points are synced from SeasonUserPoints.
      if (eligibleMembers.length) {
        for (const mbr of eligibleMembers) {
          const p = predictionByUserId.get(mbr.userId);
          if (!p) continue;

          const isKnockout = m.knockoutRound != null;
          const scored = isKnockout
            ? scoreKnockoutPredictionPoints({
                predicted: { home: p.homeScore, away: p.awayScore },
                actual: { home: homeScore, away: awayScore },
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                predictedAdvancesTeamId: p.advancesTeamId,
                actualAdvancesTeamId: advancesTeamId,
              })
            : scorePredictionPoints({
                predicted: { home: p.homeScore, away: p.awayScore },
                actual: { home: homeScore, away: awayScore },
              });

          try {
            await tx.pointsEvent.create({
              data: {
                groupId: mbr.groupId,
                userId: mbr.userId,
                matchId: m.id,
                type: "PREDICTION_SCORED",
                points: scored.points,
                reason: scored.reason,
                meta: scored.meta,
              },
              select: { id: true },
            });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              // already exists
            } else {
              throw err;
            }
          }
        }
      }

      // Sync GroupMember.points for all classic groups in this season to the canonical season points.
      if (eligibleUserIds.length && groupIds.length) {
        const seasonPoints = await tx.seasonUserPoints.findMany({
          where: {
            competitionSeasonId: m.competitionSeasonId,
            scoringSystem: "CLASSIC",
            userId: { in: eligibleUserIds },
          },
          select: { userId: true, points: true },
        });
        const pointsByUser = new Map(seasonPoints.map((r) => [r.userId, r.points] as const));

        for (const uid of eligibleUserIds) {
          const pts = pointsByUser.get(uid) ?? 0;
          await tx.groupMember.updateMany({
            where: { groupId: { in: groupIds }, userId: uid },
            data: { points: pts },
          });
        }
      }

      await tx.match.update({
        where: { id: m.id },
        data: { processedAt: new Date() },
      });

      return {
        pointsEvents: seasonEventsInserted,
        affectedGroupIds: Array.from(affectedGroupIds),
        affectedUserIds: Array.from(affectedUserIds),
      };
    });

    // Update aggregates after scoring is committed.
    // Important: do this AFTER the scoring transaction so jobs see a consistent state.
    // Also keep it sequential + deduped to avoid introducing new pool spikes.
    try {
      for (const groupId of out.affectedGroupIds) {
        await recomputeGroupMemberAccuracyAggregate(groupId);
        await recomputeGroupMomentumAggregate(groupId);
      }

      // Recompute per affected user once (deduped). Keep sequential.
      for (const userId of out.affectedUserIds) {
        await recomputeUserPredictionStatsAggregate(userId);
      }
    } catch (err) {
      console.warn("[aggregates] recompute failed after match processing:", err instanceof Error ? err.message : err);
    }

    // Standings update after processing.
    let standingsSynced = false;
    try {
      await syncCompetitionSeasonStandings({ competitionSeasonId: m.competitionSeasonId });
      standingsSynced = true;
    } catch (err) {
      console.warn("[standings] sync failed after match processing:", err instanceof Error ? err.message : err);
    }

    // Bonus scoring: once a GROUP completes, award small placement-based points.
    // This is keyed to the last match in the group to keep the SeasonPointsEvent schema simple.
    // Idempotent via SeasonPointsEvent unique constraint.
    if (m.competitionGroupId && standingsSynced) {
      try {
        const bonusOut = await prisma.$transaction(async (tx) => {
          const competitionGroupId = m.competitionGroupId!;

          // Only when all group matches are finished.
          const unfinished = await tx.match.findFirst({
            where: { competitionGroupId, status: { not: "FINISHED" } },
            select: { id: true },
          });
          if (unfinished) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          const lastMatch = await tx.match.findFirst({
            where: { competitionGroupId },
            orderBy: { kickoffAt: "desc" },
            select: { id: true },
          });
          if (!lastMatch) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          // Real final positions from standings.
          const actualRows = await tx.standingsRow.findMany({
            where: { competitionGroupId },
            select: { teamId: true, position: true, team: { select: { name: true } } },
            orderBy: { position: "asc" },
          });
          if (actualRows.length < 2) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          const teamIds = actualRows.map((r) => r.teamId);
          const teamNameById = new Map(actualRows.map((r) => [r.teamId, r.team.name] as const));
          const actualPositionByTeamId = new Map(actualRows.map((r) => [r.teamId, r.position] as const));
          const actualTop2 = new Set(actualRows.filter((r) => r.position <= 2).map((r) => r.teamId));

          // All classic groups in this season share the same SeasonUserPoints.
          const groups = await tx.group.findMany({
            where: { competitionSeasonId: m.competitionSeasonId, scoringSystem: "CLASSIC" },
            select: { id: true },
          });
          const groupIds = groups.map((g) => g.id);
          if (!groupIds.length) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          const members = await tx.groupMember.findMany({
            where: { groupId: { in: groupIds } },
            select: { groupId: true, userId: true },
          });
          const userIds = Array.from(new Set(members.map((x) => x.userId)));
          if (!userIds.length) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          const groupStageMatches = await tx.match.findMany({
            where: { competitionGroupId },
            select: { id: true },
          });
          const matchIds = groupStageMatches.map((mm) => mm.id);
          if (!matchIds.length) return { inserted: 0, affectedGroupIds: [] as string[], affectedUserIds: [] as string[] };

          // All predictions for these matches by eligible users.
          const predictions = await tx.prediction.findMany({
            where: { userId: { in: userIds }, matchId: { in: matchIds } },
            select: {
              userId: true,
              homeScore: true,
              awayScore: true,
              match: { select: { homeTeamId: true, awayTeamId: true } },
            },
          });

          const bonus = computeGroupTableBonus({
            config: { exactPositionPoints: 2, qualifierPoints: 2 },
            teamIds,
            teamNameById,
            actualPositionByTeamId,
            actualTop2,
            predictions: predictions.map((p) => ({
              userId: p.userId,
              homeTeamId: p.match.homeTeamId,
              awayTeamId: p.match.awayTeamId,
              homeScore: p.homeScore,
              awayScore: p.awayScore,
            })),
          });

          let inserted = 0;
          const affectedGroupIds = new Set<string>();
          const affectedUserIds = new Set<string>();

          // Write canonical SeasonPointsEvent once per user.
          for (const b of bonus) {
            if (b.points <= 0) continue;

            try {
              const created = await tx.seasonPointsEvent.create({
                data: {
                  competitionSeasonId: m.competitionSeasonId,
                  scoringSystem: "CLASSIC",
                  userId: b.userId,
                  matchId: lastMatch.id,
                  type: "GROUP_TABLE_BONUS",
                  points: b.points,
                  reason: "Group table bonus",
                  meta: groupTableBonusMeta({ competitionGroupId, breakdown: b.breakdown }),
                },
                select: { points: true },
              });

              inserted++;
              affectedUserIds.add(b.userId);

              await tx.seasonUserPoints.upsert({
                where: {
                  competitionSeasonId_scoringSystem_userId: {
                    competitionSeasonId: m.competitionSeasonId,
                    scoringSystem: "CLASSIC",
                    userId: b.userId,
                  },
                },
                create: {
                  competitionSeasonId: m.competitionSeasonId,
                  scoringSystem: "CLASSIC",
                  userId: b.userId,
                  points: created.points,
                },
                update: { points: { increment: created.points } },
                select: { id: true },
              });
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                // already awarded
              } else {
                throw err;
              }
            }
          }

          // Mirror as per-group PointsEvent rows for aggregates.
          if (inserted) {
            const pointsByUser = new Map(bonus.map((b) => [b.userId, b] as const));

            for (const mbr of members) {
              const b = pointsByUser.get(mbr.userId);
              if (!b || b.points <= 0) continue;

              try {
                await tx.pointsEvent.create({
                  data: {
                    groupId: mbr.groupId,
                    userId: mbr.userId,
                    matchId: lastMatch.id,
                    type: "GROUP_TABLE_BONUS",
                    points: b.points,
                    reason: "Group table bonus",
                    meta: groupTableBonusMeta({ competitionGroupId, breakdown: b.breakdown }),
                  },
                  select: { id: true },
                });
                affectedGroupIds.add(mbr.groupId);
              } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                  // already exists
                } else {
                  throw err;
                }
              }
            }

            // Sync GroupMember.points from canonical season points.
            const seasonPoints = await tx.seasonUserPoints.findMany({
              where: {
                competitionSeasonId: m.competitionSeasonId,
                scoringSystem: "CLASSIC",
                userId: { in: Array.from(affectedUserIds) },
              },
              select: { userId: true, points: true },
            });
            const seasonPointsByUser = new Map(seasonPoints.map((r) => [r.userId, r.points] as const));

            for (const uid of affectedUserIds) {
              const pts = seasonPointsByUser.get(uid) ?? 0;
              await tx.groupMember.updateMany({
                where: { groupId: { in: groupIds }, userId: uid },
                data: { points: pts },
              });
            }
          }

          return {
            inserted,
            affectedGroupIds: Array.from(affectedGroupIds),
            affectedUserIds: Array.from(affectedUserIds),
          };
        });

        if (bonusOut.inserted) {
          for (const groupId of bonusOut.affectedGroupIds) {
            await recomputeGroupMemberAccuracyAggregate(groupId);
            await recomputeGroupMomentumAggregate(groupId);
          }
          for (const userId of bonusOut.affectedUserIds) {
            await recomputeUserPredictionStatsAggregate(userId);
          }
        }
      } catch (err) {
        console.warn("[group-table-bonus] failed:", err instanceof Error ? err.message : err);
      }
    }

    processed.push({ matchId: m.id, pointsEvents: out.pointsEvents, standingsSynced });
  }

  return {
    skipped: false as const,
    scanned: candidates.length,
    processed,
  };
}
