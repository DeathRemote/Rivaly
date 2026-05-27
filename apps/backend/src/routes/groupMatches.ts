import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type GroupMatchListItem = {
  id: string;
  phaseType: "LEAGUE" | "GROUP_STAGE" | "KNOCKOUT";
  phaseLabel: string;
  kickoffAt: string;
  lockAt: string;
  visibleAt: string;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELED" | "UNKNOWN";
  home: { name: string; shortName?: string | null };
  away: { name: string; shortName?: string | null };
  userPrediction?: {
    status: "NOT_PREDICTED" | "PREDICTED" | "LOCKED" | "COMPLETED";
    summary?: string;
    homeScore?: number;
    awayScore?: number;
    source?: "QUICK_PICK" | "SCORE";
    updatedAt?: string;
  };
  result?: { homeScore: number; awayScore: number };
};

export async function registerGroupMatchesRoutes(app: FastifyInstance) {
  app.get("/api/internal/groups/:groupId/matches", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const params = z.object({ groupId: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          bucket: z.enum(["kickoff", "upcoming", "completed"]),
          limit: z.coerce.number().int().positive().max(50).optional().default(10),
          cursorKickoffAt: z.string().datetime().optional(),
          cursorId: z.string().optional(),
        })
        .parse(req.query);

      const membership = await prisma.groupMember.findFirst({
        where: { groupId: params.groupId, userId },
        select: { id: true, group: { select: { competitionSeasonId: true } } },
      });

      if (!membership) return reply.code(403).send({ error: "Forbidden" });

      const seasonId = membership.group.competitionSeasonId;
      if (!seasonId) return reply.code(400).send({ error: "Group is not linked to a competition season" });

      const now = new Date();

      // Cursor handling (kickoffAt,id)
      const cursorKickoffAt = query.cursorKickoffAt ? new Date(query.cursorKickoffAt) : null;
      const cursorId = query.cursorId ?? null;

      const baseWhere: any = {
        competitionSeasonId: seasonId,
        status: { not: "CANCELED" },
      };

      if (query.bucket === "kickoff") {
        // Kickoff tab = everything in the "prediction window" and onwards until the match completes.
        // That means: visibleAt <= now and NOT finished/canceled/postponed.
        // Includes locked matches (now >= lockAt) so users can still see what they predicted.
        baseWhere.status = { in: ["SCHEDULED", "LIVE", "UNKNOWN"] };
        baseWhere.visibleAt = { lte: now };
        // no lockAt filter
      }

      if (query.bucket === "upcoming") {
        // Upcoming tab = not yet in prediction window.
        baseWhere.status = { in: ["SCHEDULED", "LIVE", "UNKNOWN"] };
        baseWhere.visibleAt = { gt: now };

        if (cursorKickoffAt && cursorId) {
          baseWhere.OR = [
            { kickoffAt: { gt: cursorKickoffAt } },
            { kickoffAt: cursorKickoffAt, id: { gt: cursorId } },
          ];
        }
      }

      if (query.bucket === "completed") {
        // Completed = finished OR we have a persisted result.
        // Some provider status strings map to UNKNOWN even when scores are in.
        baseWhere.OR = [{ status: "FINISHED" }, { result: { isNot: null } }];

        if (cursorKickoffAt && cursorId) {
          baseWhere.AND = [
            {
              OR: [
                { kickoffAt: { lt: cursorKickoffAt } },
                { kickoffAt: cursorKickoffAt, id: { lt: cursorId } },
              ],
            },
          ];
        }
      }

      const matches = await prisma.match.findMany({
        where: baseWhere,
        select: {
          id: true,
          kickoffAt: true,
          lockAt: true,
          visibleAt: true,
          status: true,
          providerRound: true,
          providerGroupKey: true,
          knockoutRound: true,
          competitionPhase: { select: { type: true } },
          competitionGroup: { select: { key: true } },
          homeTeam: { select: { name: true, shortName: true } },
          awayTeam: { select: { name: true, shortName: true } },
          result: { select: { homeScore: true, awayScore: true } },
        },
        orderBy:
          query.bucket === "completed"
            ? [{ kickoffAt: "desc" }, { id: "desc" }]
            : [{ kickoffAt: "asc" }, { id: "asc" }],
        take: query.bucket === "kickoff" ? 50 : query.limit + 1,
      });

      // Load predictions for these matches.
      const matchIds = matches.map((m) => m.id);
      const preds =
        matchIds.length === 0
          ? []
          : await prisma.prediction.findMany({
              where: { userId, matchId: { in: matchIds } },
              select: { matchId: true, homeScore: true, awayScore: true, source: true, updatedAt: true },
            });
      const predByMatchId = new Map(preds.map((p) => [p.matchId, p] as const));

      const page = query.bucket === "kickoff" ? matches : matches.slice(0, query.limit);
      const hasMore = query.bucket === "kickoff" ? false : matches.length > query.limit;

      const out: GroupMatchListItem[] = page.map((m) => {
        const phaseType = m.competitionPhase?.type === "GROUP_STAGE" ? "GROUP_STAGE" : m.competitionPhase?.type === "KNOCKOUT" ? "KNOCKOUT" : "LEAGUE";
        const phaseLabel =
          phaseType === "GROUP_STAGE"
            ? `Group ${(m.competitionGroup?.key ?? m.providerGroupKey ?? "?").toString().trim()}`
            : phaseType === "KNOCKOUT"
              ? formatKnockoutRound(m.knockoutRound)
              : m.providerRound
                ? `Gameweek ${m.providerRound}`
                : "Matchday";

        const status = m.status === "FINISHED" ? "FINAL" : m.status;

        const p = predByMatchId.get(m.id);

        const lockAt = (m.lockAt ?? m.kickoffAt).toISOString();
        const visibleAt = (m.visibleAt ?? m.kickoffAt).toISOString();

        const lockAtDate = m.lockAt ?? m.kickoffAt;
        const locked = now.getTime() >= lockAtDate.getTime();

        const userPrediction: GroupMatchListItem["userPrediction"] = p
          ? {
              status: status === "FINAL" ? "COMPLETED" : locked ? "LOCKED" : "PREDICTED",
              summary: `${p.homeScore}-${p.awayScore}`,
              homeScore: p.homeScore,
              awayScore: p.awayScore,
              source: p.source === "QUICK_PICK" ? "QUICK_PICK" : "SCORE",
              updatedAt: p.updatedAt.toISOString(),
            }
          : undefined;

        return {
          id: m.id,
          phaseType,
          phaseLabel,
          kickoffAt: m.kickoffAt.toISOString(),
          lockAt,
          visibleAt,
          status,
          home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName },
          away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName },
          userPrediction,
          result: m.result ? { homeScore: m.result.homeScore, awayScore: m.result.awayScore } : undefined,
        };
      });

      const nextCursor = hasMore
        ? {
            cursorKickoffAt: page[page.length - 1]!.kickoffAt.toISOString(),
            cursorId: page[page.length - 1]!.id,
          }
        : null;

      return { matches: out, nextCursor };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}

function formatKnockoutRound(r: string | null): string {
  if (!r) return "Knockout";
  switch (r) {
    case "R128":
      return "Round of 128";
    case "R64":
      return "Round of 64";
    case "R32":
      return "Round of 32";
    case "R16":
      return "Round of 16";
    case "QF":
      return "Quarterfinal";
    case "SF":
      return "Semifinal";
    case "FINAL":
      return "Final";
    case "THIRD_PLACE":
      return "Third Place";
    case "PLAYOFF":
      return "Playoff";
    case "QUALIFIER":
      return "Qualifier";
    default:
      return "Knockout";
  }
}
