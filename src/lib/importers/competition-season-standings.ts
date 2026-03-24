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

  for (const r of rows) {
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
        position: r.intRank,
        played: r.intPlayed,
        wins: r.intWin,
        draws: r.intDraw,
        losses: r.intLoss,
        goalDifference: r.intGoalDifference ?? 0,
        points: r.intPoints,
        provider: Provider.THESPORTSDB,
        providerTeamId: r.idTeam,
      },
      update: {
        position: r.intRank,
        played: r.intPlayed,
        wins: r.intWin,
        draws: r.intDraw,
        losses: r.intLoss,
        goalDifference: r.intGoalDifference ?? 0,
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
