import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export async function registerGroupTablesRoutes(app: FastifyInstance) {
  app.get("/api/internal/groups/:groupId/tables", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const params = z.object({ groupId: z.string().min(1) }).parse(req.params);

      const membership = await prisma.groupMember.findFirst({
        where: { groupId: params.groupId, userId },
        select: { id: true, group: { select: { competitionSeasonId: true } } },
      });

      if (!membership) return reply.code(403).send({ error: "Forbidden" });

      const seasonId = membership.group.competitionSeasonId;
      if (!seasonId) return reply.code(400).send({ error: "Group is not linked to a competition season" });

      // Reuse the same logic as /api/internal/tables.
      const res = await prisma.competitionSeason.findUnique({
        where: { id: seasonId },
        select: {
          id: true,
          seasonLabel: true,
          standingsUpdatedAt: true,
          competition: { select: { name: true } },
          phases: { select: { id: true, type: true } },
        },
      });

      if (!res) return reply.code(404).send({ error: "CompetitionSeason not found" });

      const title = `${res.competition.name} ${res.seasonLabel}`;

      // If group stage exists, return group tables (scoped standings) else league table.
      const groupPhase = res.phases.find((p) => p.type === "GROUP_STAGE") ?? null;

      if (groupPhase) {
        const groups = await prisma.competitionGroup.findMany({
          where: { competitionPhaseId: groupPhase.id },
          select: { id: true, key: true, name: true, order: true },
          orderBy: [{ order: "asc" }, { key: "asc" }],
        });

        const scopePrefix = `season:${res.id}:phase:${groupPhase.id}:group:`;

        const rows = await prisma.standingsRow.findMany({
          where: {
            competitionSeasonId: res.id,
            competitionPhaseId: groupPhase.id,
            scope: { startsWith: scopePrefix },
          },
          orderBy: [{ competitionGroupId: "asc" }, { position: "asc" }, { team: { name: "asc" } }],
          select: {
            competitionGroupId: true,
            teamId: true,
            position: true,
            played: true,
            goalDifference: true,
            points: true,
            team: { select: { name: true, shortName: true } },
          },
        });

        const byGroup = new Map<string, any[]>();
        for (const r of rows) {
          const gid = r.competitionGroupId;
          if (!gid) continue;
          const arr = byGroup.get(gid) ?? [];
          arr.push({
            teamId: r.teamId,
            teamName: r.team.shortName ?? r.team.name,
            position: r.position,
            played: r.played,
            goalDifference: r.goalDifference,
            points: r.points,
          });
          byGroup.set(gid, arr);
        }

        return {
          seasonId: res.id,
          title,
          updatedAt: res.standingsUpdatedAt ? res.standingsUpdatedAt.toISOString() : null,
          league: null,
          groups: groups.map((g) => ({
            competitionGroupId: g.id,
            key: g.key,
            name: g.name,
            rows: byGroup.get(g.id) ?? [],
          })),
        };
      }

      const leagueRows = await prisma.standingsRow.findMany({
        where: {
          competitionSeasonId: res.id,
          scope: `season:${res.id}`,
        },
        orderBy: [{ position: "asc" }, { team: { name: "asc" } }],
        select: {
          teamId: true,
          played: true,
          wins: true,
          draws: true,
          losses: true,
          goalDifference: true,
          points: true,
          team: { select: { name: true, shortName: true } },
        },
      });

      return {
        seasonId: res.id,
        title,
        updatedAt: res.standingsUpdatedAt ? res.standingsUpdatedAt.toISOString() : null,
        league: {
          rows: leagueRows.map((r, idx) => ({
            teamId: r.teamId,
            teamName: r.team.shortName ?? r.team.name,
            position: idx + 1,
            played: r.played,
            goalDifference: r.goalDifference,
            points: r.points,
          })),
        },
        groups: [],
      };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}
