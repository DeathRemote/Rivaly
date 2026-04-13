import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type TableRow = {
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

export type TablesGroupTable = {
  competitionGroupId: string;
  key: string;
  name: string;
  rows: TableRow[];
};

export type TablesPayload = {
  seasonId: string;
  title: string;
  updatedAt: string | null;
  league: { rows: TableRow[] } | null;
  groups: TablesGroupTable[];
};

export async function registerTablesRoutes(app: FastifyInstance) {
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

      const unique = new Map<string, { seasonId: string; title: string; updatedAt: Date | null }>();
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

      const out: TablesSeasonOption[] = Array.from(unique.values())
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

  app.get("/api/internal/tables", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const query = z.object({ seasonId: z.string().min(1) }).parse(req.query);

      // Must belong to at least one group in this season.
      const membership = await prisma.groupMember.findFirst({
        where: { userId, group: { competitionSeasonId: query.seasonId } },
        select: { id: true },
      });
      if (!membership) return reply.code(403).send({ error: "Forbidden" });

      const season = await prisma.competitionSeason.findUnique({
        where: { id: query.seasonId },
        select: {
          id: true,
          seasonLabel: true,
          standingsUpdatedAt: true,
          competition: { select: { name: true } },
        },
      });
      if (!season) return reply.code(404).send({ error: "CompetitionSeason not found" });

      const title = `${season.competition.name} ${season.seasonLabel}`;

      // GROUP STAGE tables (preferred when present)
      const groups = await loadGroupStageTables(season.id);

      // LEAGUE table: only show if there are no groups (league-based or league-phase comps).
      const league = groups.length === 0 ? await loadLeagueTable(season.id) : null;

      const payload: TablesPayload = {
        seasonId: season.id,
        title,
        updatedAt: season.standingsUpdatedAt ? season.standingsUpdatedAt.toISOString() : null,
        league,
        groups,
      };

      reply.header("Cache-Control", "private, max-age=30");
      return payload;
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}

async function loadLeagueTable(competitionSeasonId: string) {
  const rows = await prisma.standingsRow.findMany({
    where: {
      competitionSeasonId,
      scope: `season:${competitionSeasonId}`,
    },
    orderBy: [{ position: "asc" }, { team: { name: "asc" } }],
    select: {
      teamId: true,
      played: true,
      goalDifference: true,
      points: true,
      team: { select: { name: true, shortName: true } },
    },
  });

  if (!rows.length) return null;

  return {
    rows: rows.map((r, idx) => ({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: idx + 1,
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    })),
  };
}

async function loadGroupStageTables(competitionSeasonId: string): Promise<TablesGroupTable[]> {
  // We store computed group standings under scope:
  // season:<seasonId>:phase:<phaseId>:group:<groupId>
  // But to show teams with 0 played, we also ensure group membership exists
  // by seeding from matches (in case standings haven't synced yet).

  const groups = await prisma.competitionGroup.findMany({
    where: {
      competitionPhase: {
        competitionSeasonId,
        type: "GROUP_STAGE",
      },
    },
    select: { id: true, key: true, name: true, order: true, competitionPhaseId: true },
    orderBy: [{ order: "asc" }, { key: "asc" }],
  });

  if (!groups.length) return [];

  const phaseId = groups[0]!.competitionPhaseId;

  const standings = await prisma.standingsRow.findMany({
    where: {
      competitionSeasonId,
      competitionPhaseId: phaseId,
      competitionGroupId: { in: groups.map((g) => g.id) },
      scope: { startsWith: `season:${competitionSeasonId}:phase:${phaseId}:group:` },
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

  const rowsByGroup = new Map<string, TableRow[]>();
  for (const r of standings) {
    const gid = r.competitionGroupId;
    if (!gid) continue;
    const arr = rowsByGroup.get(gid) ?? [];
    arr.push({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: r.position,
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    });
    rowsByGroup.set(gid, arr);
  }

  // If standings are missing or incomplete, compute from matches as a fallback.
  // This also ensures teams with 0 played show up.
  const fallback = await computeGroupStageTablesFromMatches(competitionSeasonId, groups.map((g) => g.id));

  return groups.map((g) => {
    const cachedRows = rowsByGroup.get(g.id);
    const fallbackRows = fallback.get(g.id) ?? [];
    return {
      competitionGroupId: g.id,
      key: g.key,
      name: g.name,
      rows: cachedRows?.length ? cachedRows : fallbackRows,
    };
  });
}

async function computeGroupStageTablesFromMatches(
  competitionSeasonId: string,
  groupIds: string[],
): Promise<Map<string, TableRow[]>> {
  const matches = await prisma.match.findMany({
    where: {
      competitionSeasonId,
      competitionGroupId: { in: groupIds },
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

  type Stats = { teamId: string; teamName: string; played: number; gf: number; ga: number; points: number };
  const statsByGroup = new Map<string, Map<string, Stats>>();

  function ensure(gid: string, teamId: string, teamName: string) {
    const byTeam = statsByGroup.get(gid) ?? new Map<string, Stats>();
    statsByGroup.set(gid, byTeam);
    const s = byTeam.get(teamId) ?? { teamId, teamName, played: 0, gf: 0, ga: 0, points: 0 };
    byTeam.set(teamId, s);
    return s;
  }

  for (const m of matches) {
    const gid = m.competitionGroupId;
    if (!gid) continue;

    const homeName = m.homeTeam.shortName ?? m.homeTeam.name;
    const awayName = m.awayTeam.shortName ?? m.awayTeam.name;

    const home = ensure(gid, m.homeTeamId, homeName);
    const away = ensure(gid, m.awayTeamId, awayName);

    if (m.status !== "FINISHED" || !m.result) continue;

    const res = m.result;
    home.played++;
    away.played++;

    home.gf += res.homeScore;
    home.ga += res.awayScore;

    away.gf += res.awayScore;
    away.ga += res.homeScore;

    if (res.homeScore > res.awayScore) home.points += 3;
    else if (res.homeScore < res.awayScore) away.points += 3;
    else {
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

  const out = new Map<string, TableRow[]>();
  for (const [gid, byTeam] of statsByGroup.entries()) {
    out.set(gid, toRows(byTeam));
  }

  // Ensure every groupId exists in map
  for (const gid of groupIds) {
    if (!out.has(gid)) out.set(gid, []);
  }

  return out;
}
