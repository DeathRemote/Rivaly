import { unstable_cache } from "next/cache";
import { Sport } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminCompetition = {
  id: string;
  sport: Sport;
  name: string;
  country: string | null;
  published: boolean;
  provider: string | null;
  providerLeagueId: string | null;
  seasons: Array<{
    id: string;
    seasonLabel: string;
    published: boolean;
    archivedAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    provider: string | null;
    providerSeasonId: string | null;
    fixturesSyncedAt: string | null;
    fixturesSyncError: string | null;
  }>;
};

async function readCatalog(): Promise<AdminCompetition[]> {
  const competitions = await prisma.competition.findMany({
    orderBy: [{ sport: "asc" }, { name: "asc" }],
    select: {
      id: true,
      sport: true,
      name: true,
      country: true,
      published: true,
      provider: true,
      providerLeagueId: true,
      seasons: {
        orderBy: [{ seasonLabel: "desc" }],
        select: {
          id: true,
          seasonLabel: true,
          published: true,
          archivedAt: true,
          startsAt: true,
          endsAt: true,
          provider: true,
          providerSeasonId: true,
          fixturesSyncedAt: true,
          fixturesSyncError: true,
        },
      },
    },
  });

  return competitions.map((c) => ({
    ...c,
    seasons: c.seasons.map((s) => ({
      ...s,
      archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
      startsAt: s.startsAt ? s.startsAt.toISOString() : null,
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      fixturesSyncedAt: s.fixturesSyncedAt ? s.fixturesSyncedAt.toISOString() : null,
    })),
  }));
}

export const getAdminCatalogCached = unstable_cache(readCatalog, ["admin:catalog:v1"], {
  revalidate: 60,
  tags: ["admin:catalog"],
});
