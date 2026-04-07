import { prisma } from "../src/lib/prisma";
import { TheSportsDbClient } from "../src/lib/providers/thesportsdb/client";

async function main() {
  const seasonId = process.argv[2];
  if (!seasonId) {
    console.error("Usage: npx tsx scripts/debug-standings.ts <competitionSeasonId>");
    process.exit(1);
  }

  const season = await prisma.competitionSeason.findUnique({
    where: { id: seasonId },
    include: { competition: true },
  });
  if (!season) throw new Error("Season not found");

  const leagueId = season.competition.providerLeagueId;
  if (!leagueId) throw new Error("Missing providerLeagueId");

  console.log({ seasonId, seasonLabel: season.seasonLabel, leagueId });

  const client = new TheSportsDbClient();
  const rows = await client.lookupLeagueTable(leagueId, season.seasonLabel);

  console.log("rows:", rows.length);
  console.log(rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
