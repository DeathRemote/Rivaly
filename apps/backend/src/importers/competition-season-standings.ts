import { prisma } from "../prisma.js";
import { CompetitionPhaseType, Provider } from "@prisma/client";

import { TheSportsDbClient } from "../providers/thesportsdb/client.js";

export async function syncCompetitionSeasonStandings(opts: {
  competitionSeasonId: string;
  dryRun?: boolean;
  reset?: boolean;
}) {
  const season = await prisma.competitionSeason.findUnique({
    where: { id: opts.competitionSeasonId },
    include: { competition: true },
  });

  if (!season) throw new Error("CompetitionSeason not found");
  if (season.provider !== Provider.THESPORTSDB) {
    throw new Error(`Unsupported provider for standings sync: ${season.provider ?? "<null>"}`);
  }

  const leagueId = season.competition.providerLeagueId;
  if (!leagueId) throw new Error("Missing competition.providerLeagueId");

  const scope = `season:${season.id}`;

  if (opts.reset && !opts.dryRun) {
    await prisma.standingsRow.deleteMany({ where: { scope } });
  }

  const client = new TheSportsDbClient();
  const rows = await client.lookupLeagueTable(leagueId, season.seasonLabel);

  let upserted = 0;

  if (!opts.dryRun) {
    await prisma.standingsRow.deleteMany({ where: { scope } });
  }

  const sorted = [...rows].sort((a, b) => {
    if (b.intPoints !== a.intPoints) return b.intPoints - a.intPoints;

    const agf = a.intGoalsFor ?? 0;
    const bgf = b.intGoalsFor ?? 0;
    if (bgf !== agf) return bgf - agf;

    const aga = a.intGoalsAgainst ?? 0;
    const bga = b.intGoalsAgainst ?? 0;
    if (aga !== bga) return aga - bga;

    return a.intRank - b.intRank;
  });

  for (const [idx, r] of sorted.entries()) {
    if (!r.idTeam) continue;

    const team = await prisma.team.upsert({
      where: {
        provider_providerTeamId: {
          provider: Provider.THESPORTSDB,
          providerTeamId: r.idTeam,
        },
      },
      create: {
        provider: Provider.THESPORTSDB,
        providerTeamId: r.idTeam,
        name: r.strTeam,
      },
      update: {
        name: r.strTeam,
      },
    });

    if (opts.dryRun) continue;

    await prisma.standingsRow.upsert({
      where: {
        scope_teamId: {
          scope,
          teamId: team.id,
        },
      },
      create: {
        competitionSeasonId: season.id,
        scope,
        teamId: team.id,
        position: idx + 1,
        played: r.intPlayed,
        wins: r.intWin,
        draws: r.intDraw,
        losses: r.intLoss,
        goalsFor: r.intGoalsFor ?? 0,
        goalsAgainst: r.intGoalsAgainst ?? 0,
        goalDifference:
          r.intGoalDifference ??
          (r.intGoalsFor != null && r.intGoalsAgainst != null ? r.intGoalsFor - r.intGoalsAgainst : 0),
        points: r.intPoints,
        provider: Provider.THESPORTSDB,
        providerTeamId: r.idTeam,
      },
      update: {
        position: idx + 1,
        played: r.intPlayed,
        wins: r.intWin,
        draws: r.intDraw,
        losses: r.intLoss,
        goalsFor: r.intGoalsFor ?? 0,
        goalsAgainst: r.intGoalsAgainst ?? 0,
        goalDifference:
          r.intGoalDifference ??
          (r.intGoalsFor != null && r.intGoalsAgainst != null ? r.intGoalsFor - r.intGoalsAgainst : 0),
        points: r.intPoints,
      },
    });

    upserted++;
  }

  let groupStageUpserted = 0;
  try {
    groupStageUpserted = await syncGroupStageStandings({
      competitionSeasonId: season.id,
      dryRun: opts.dryRun,
      reset: opts.reset,
    });
  } catch (err) {
    console.warn("[standings] group stage sync failed:", err instanceof Error ? err.message : err);
  }

  if (!opts.dryRun) {
    await prisma.competitionSeason.update({
      where: { id: season.id },
      data: { standingsUpdatedAt: new Date() },
    });
  }

  return {
    leagueId,
    seasonLabel: season.seasonLabel,
    rows: rows.length,
    upserted,
    groupStageUpserted,
  };
}

async function syncGroupStageStandings(opts: {
  competitionSeasonId: string;
  dryRun?: boolean;
  reset?: boolean;
}): Promise<number> {
  const phase = await prisma.competitionPhase.findFirst({
    where: {
      competitionSeasonId: opts.competitionSeasonId,
      type: CompetitionPhaseType.GROUP_STAGE,
    },
    select: { id: true },
  });

  if (!phase) return 0;

  const groups = await prisma.competitionGroup.findMany({
    where: { competitionPhaseId: phase.id },
    select: { id: true },
  });

  if (groups.length === 0) return 0;

  const groupIds = groups.map((g) => g.id);

  const matches = await prisma.match.findMany({
    where: {
      competitionSeasonId: opts.competitionSeasonId,
      competitionGroupId: { in: groupIds },
      status: { notIn: ["CANCELED"] },
    },
    select: {
      competitionGroupId: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      result: { select: { homeScore: true, awayScore: true } },
    },
  });

  type Stats = {
    teamId: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
    points: number;
  };

  const statsByGroup = new Map<string, Map<string, Stats>>();

  function ensure(gid: string, teamId: string) {
    const byTeam = statsByGroup.get(gid) ?? new Map<string, Stats>();
    statsByGroup.set(gid, byTeam);
    const s =
      byTeam.get(teamId) ??
      ({
        teamId,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        points: 0,
      } satisfies Stats);
    byTeam.set(teamId, s);
    return s;
  }

  for (const m of matches) {
    const gid = m.competitionGroupId;
    if (!gid) continue;

    const home = ensure(gid, m.homeTeamId);
    const away = ensure(gid, m.awayTeamId);

    if (m.status !== "FINISHED" || !m.result) continue;

    const { homeScore, awayScore } = m.result;

    home.played++;
    away.played++;

    home.gf += homeScore;
    home.ga += awayScore;

    away.gf += awayScore;
    away.ga += homeScore;

    if (homeScore > awayScore) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (homeScore < awayScore) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points += 1;
      away.points += 1;
    }
  }

  const scopePrefix = `season:${opts.competitionSeasonId}:phase:${phase.id}:group:`;

  if (!opts.dryRun) {
    if (opts.reset) {
      await prisma.standingsRow.deleteMany({
        where: {
          competitionSeasonId: opts.competitionSeasonId,
          competitionPhaseId: phase.id,
          scope: { startsWith: scopePrefix },
        },
      });
    }

    await prisma.standingsRow.deleteMany({
      where: {
        competitionSeasonId: opts.competitionSeasonId,
        competitionPhaseId: phase.id,
        scope: { startsWith: scopePrefix },
      },
    });
  }

  if (opts.dryRun) return 0;

  let upserted = 0;

  for (const gid of groupIds) {
    const byTeam = statsByGroup.get(gid) ?? new Map<string, Stats>();
    const arr = Array.from(byTeam.values());

    arr.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGD = a.gf - a.ga;
      const bGD = b.gf - b.ga;
      if (bGD !== aGD) return bGD - aGD;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.ga !== b.ga) return a.ga - b.ga;
      return a.teamId.localeCompare(b.teamId);
    });

    for (const [idx, s] of arr.entries()) {
      const scope = `${scopePrefix}${gid}`;

      await prisma.standingsRow.upsert({
        where: {
          scope_teamId: {
            scope,
            teamId: s.teamId,
          },
        },
        create: {
          competitionSeasonId: opts.competitionSeasonId,
          competitionPhaseId: phase.id,
          competitionGroupId: gid,
          scope,
          teamId: s.teamId,
          position: idx + 1,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.gf,
          goalsAgainst: s.ga,
          goalDifference: s.gf - s.ga,
          points: s.points,
        },
        update: {
          position: idx + 1,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.gf,
          goalsAgainst: s.ga,
          goalDifference: s.gf - s.ga,
          points: s.points,
        },
      });

      upserted++;
    }
  }

  return upserted;
}
