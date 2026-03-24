import { prisma } from "@/lib/prisma";
import { Provider, Sport } from "@prisma/client";

const ALLSVENSKAN_LEAGUE_ID = "4347"; // TheSportsDB league id for Swedish Allsvenskan (football)

export async function ensureAllsvenskan2026Published() {
  const competition = await prisma.competition.upsert({
    where: {
      provider_providerLeagueId: {
        provider: Provider.THESPORTSDB,
        providerLeagueId: ALLSVENSKAN_LEAGUE_ID,
      },
    },
    create: {
      sport: Sport.SOCCER,
      name: "Allsvenskan",
      country: "Sweden",
      published: true,
      provider: Provider.THESPORTSDB,
      providerLeagueId: ALLSVENSKAN_LEAGUE_ID,
    },
    update: {
      name: "Allsvenskan",
      country: "Sweden",
      published: true,
    },
  });

  const season = await prisma.competitionSeason.upsert({
    where: {
      competitionId_seasonLabel: {
        competitionId: competition.id,
        seasonLabel: "2026",
      },
    },
    create: {
      competitionId: competition.id,
      seasonLabel: "2026",
      published: true,
      provider: Provider.THESPORTSDB,
    },
    update: {
      published: true,
      provider: Provider.THESPORTSDB,
    },
  });

  return { competition, season };
}
