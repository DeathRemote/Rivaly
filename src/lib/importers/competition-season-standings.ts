import { prisma } from "@/lib/prisma";
import { Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";

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

  if (opts.reset && !opts.dryRun) {
    await prisma.standingsRow.deleteMany({ where: { competitionSeasonId: season.id } });
  }

  const client = new TheSportsDbClient();
  const rows = await client.lookupLeagueTable(leagueId, season.seasonLabel);

  let upserted = 0;

  // IMPORTANT: tables can change shape as matches finish. If we only upsert returned rows,
  // any missing teams keep stale data and the table looks "unsorted"/wrong.
  // Safer approach: replace the whole season snapshot each sync.
  if (!opts.dryRun) {
    await prisma.standingsRow.deleteMany({ where: { competitionSeasonId: season.id } });
  }

  // Sort + compute positions ourselves to ensure consistent ordering.
  // Desired tiebreakers: points DESC, goalsFor DESC, goalsAgainst ASC.
  const sorted = [...rows].sort((a, b) => {
    if (b.intPoints !== a.intPoints) return b.intPoints - a.intPoints;

    const agf = a.intGoalsFor ?? 0;
    const bgf = b.intGoalsFor ?? 0;
    if (bgf !== agf) return bgf - agf;

    const aga = a.intGoalsAgainst ?? 0;
    const bga = b.intGoalsAgainst ?? 0;
    if (aga !== bga) return aga - bga;

    // fall back to provider rank for stability
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
        competitionSeasonId_teamId: {
          competitionSeasonId: season.id,
          teamId: team.id,
        },
      },
      create: {
        competitionSeasonId: season.id,
        teamId: team.id,
        position: idx + 1,
        played: r.intPlayed,
        wins: r.intWin,
        draws: r.intDraw,
        losses: r.intLoss,
        goalsFor: r.intGoalsFor ?? 0,
        goalsAgainst: r.intGoalsAgainst ?? 0,
        goalDifference:
          r.intGoalDifference ?? (r.intGoalsFor != null && r.intGoalsAgainst != null ? r.intGoalsFor - r.intGoalsAgainst : 0),
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
          r.intGoalDifference ?? (r.intGoalsFor != null && r.intGoalsAgainst != null ? r.intGoalsFor - r.intGoalsAgainst : 0),
        points: r.intPoints,
      },
    });

    upserted++;
  }

  if (!opts.dryRun) {
    await prisma.competitionSeason.update({
      where: { id: season.id },
      data: { standingsUpdatedAt: new Date() },
    });
  }

  return { leagueId, seasonLabel: season.seasonLabel, rows: rows.length, upserted };
}
