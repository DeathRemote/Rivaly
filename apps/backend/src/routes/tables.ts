import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

type TableRow = {
  teamId: string;
  teamName: string;
  position: number;
  played: number;
  goalDifference: number;
  points: number;
};

export type TablesSeasonOption = {
  seasonId: string;
  title: string;
};

export type TablesPayload = {
  seasonId: string;
  title: string;
  league: { rows: TableRow[] } | null;
  groups: Array<{ competitionGroupId: string; key: string; name: string; rows: TableRow[] }>;
  updatedAt: string | null;
};

export async function registerTablesRoutes(app: FastifyInstance) {
  // List seasons the user has access to (via group membership)
  app.get("/api/internal/table-seasons", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const seasons = await prisma.group.findMany({
        where: { members: { some: { userId } }, competitionSeasonId: { not: null } },
        select: {
          competitionSeason: {
            select: {
              id: true,
              seasonLabel: true,
              standingsUpdatedAt: true,
              competition: { select: { name: true } },
            },
          },
        },
      });

      const unique = new Map<string, TablesSeasonOption & { updatedAt: Date | null }>();
      for (const g of seasons) {
        const s = g.competitionSeason;
        if (!s) continue;
        if (!unique.has(s.id)) {
          unique.set(s.id, {
            seasonId: s.id,
            title: `${s.competition.name} ${s.seasonLabel}`,
            updatedAt: s.standingsUpdatedAt ?? null,
          });
        }
      }

      // Sort: most recently updated first (fallback by title)
      const out = Array.from(unique.values())
        .sort((a, b) => {
          const at = a.updatedAt?.getTime() ?? 0;
          const bt = b.updatedAt?.getTime() ?? 0;
          if (bt !== at) return bt - at;
          return a.title.localeCompare(b.title);
        })
        .map(({ updatedAt, ...rest }) => rest);

      return { seasons: out };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });

  // Load a single season tables (league + group stage tables)
  app.get("/api/internal/tables", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const query = z
        .object({
          seasonId: z.string().min(1),
        })
        .parse(req.query);

      // Authorization: must have membership in any group tied to this season.
      const membership = await prisma.groupMember.findFirst({
        where: { userId, group: { competitionSeasonId: query.seasonId } },
        select: { id: true },
      });

      if (!membership) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const season = await prisma.competitionSeason.findUnique({
        where: { id: query.seasonId },
        select: {
          id: true,
          seasonLabel: true,
          standingsUpdatedAt: true,
          competition: { select: { name: true } },
        },
      });

      if (!season) {
        return reply.code(404).send({ error: "CompetitionSeason not found" });
      }

      const title = `${season.competition.name} ${season.seasonLabel}`;

      // LEAGUE TABLE (provider snapshot)
      const leagueRows = await prisma.standingsRow.findMany({
        where: {
          competitionSeasonId: season.id,
          // league table snapshot uses scope = season:<id>
          scope: `season:${season.id}`,
        },
        orderBy: [{ position: "asc" }, { team: { name: "asc" } }],
        select: {
          teamId: true,
          played: true,
          goalDifference: true,
          points: true,
          team: { select: { name: true, shortName: true } },
          goalsFor: true,
          goalsAgainst: true,
        },
      });

      const league = leagueRows.length
        ? {
            rows: leagueRows.map((r, idx) => ({
              teamId: r.teamId,
              teamName: r.team.shortName ?? r.team.name,
              position: idx + 1,
              played: r.played,
              goalDifference: r.goalDifference,
              points: r.points,
            })),
          }
        : null;

      // GROUP STAGE TABLES (derived from finished matches)
      const groups = await computeGroupStageTables(season.id);

      const payload: TablesPayload = {
        seasonId: season.id,
        title,
        league,
        groups,
        updatedAt: season.standingsUpdatedAt ? season.standingsUpdatedAt.toISOString() : null,
      };

      // Cache guidance: this endpoint is user-authenticated, but the payload is season-scoped.
      // We keep it private and short; client/UI can cache in-memory.
      reply.header("Cache-Control", "private, max-age=30");

      return payload;
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}

async function computeGroupStageTables(competitionSeasonId: string) {
  // Load competition groups for GROUP_STAGE phases.
  const groups = await prisma.competitionGroup.findMany({
    where: {
      competitionPhase: {
        competitionSeasonId,
        type: "GROUP_STAGE",
      },
    },
    select: {
      id: true,
      key: true,
      name: true,
      order: true,
    },
    orderBy: [{ order: "asc" }, { key: "asc" }],
  });

  if (groups.length === 0) return [] as Array<{ competitionGroupId: string; key: string; name: string; rows: TableRow[] }>;

  const groupIds = groups.map((g) => g.id);

  // Load all matches so we can include teams that haven't played yet.
  // Only FINISHED matches contribute points/goals.
  const matches = await prisma.match.findMany({
    where: {
      competitionSeasonId,
      competitionGroupId: { in: groupIds },
      // Ignore canceled/postponed for the purpose of seeding teams.
      status: { notIn: ["CANCELED"] },
    },
    select: {
      competitionGroupId: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      result: { select: { homeScore: true, awayScore: true } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
    },
  });

  type Stats = {
    teamId: string;
    teamName: string;
    played: number;
    gf: number;
    ga: number;
    points: number;
  };

  const statsByGroup = new Map<string, Map<string, Stats>>();

  function ensure(groupId: string, teamId: string, teamName: string) {
    const byTeam = statsByGroup.get(groupId) ?? new Map<string, Stats>();
    statsByGroup.set(groupId, byTeam);
    const s = byTeam.get(teamId) ?? { teamId, teamName, played: 0, gf: 0, ga: 0, points: 0 };
    byTeam.set(teamId, s);
    return s;
  }

  for (const m of matches) {
    const gid = m.competitionGroupId;
    if (!gid) continue;

    const homeName = m.homeTeam.shortName ?? m.homeTeam.name;
    const awayName = m.awayTeam.shortName ?? m.awayTeam.name;

    // Seed teams even if they haven't played yet.
    const home = ensure(gid, m.homeTeamId, homeName);
    const away = ensure(gid, m.awayTeamId, awayName);

    // Only finished matches with results contribute.
    if (m.status !== "FINISHED" || !m.result) continue;

    const res = m.result;

    home.played++;
    away.played++;

    home.gf += res.homeScore;
    home.ga += res.awayScore;

    away.gf += res.awayScore;
    away.ga += res.homeScore;

    if (res.homeScore > res.awayScore) {
      home.points += 3;
    } else if (res.homeScore < res.awayScore) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  function toRows(map: Map<string, Stats>): TableRow[] {
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGD = a.gf - a.ga;
      const bGD = b.gf - b.ga;
      if (bGD !== aGD) return bGD - aGD;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.ga !== b.ga) return a.ga - b.ga;
      return a.teamName.localeCompare(b.teamName);
    });

    return arr.map((s, idx) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      position: idx + 1,
      played: s.played,
      goalDifference: s.gf - s.ga,
      points: s.points,
    }));
  }

  return groups.map((g) => {
    const byTeam = statsByGroup.get(g.id) ?? new Map<string, Stats>();
    return {
      competitionGroupId: g.id,
      key: g.key,
      name: g.name,
      rows: toRows(byTeam),
    };
  });
}
