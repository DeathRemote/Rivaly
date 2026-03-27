import { Sport } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export type SportConfigRow = { sport: Sport; enabled: boolean };

export async function ensureSportRows() {
  // Ensure one row per enum so admin can toggle without manual seeding.
  const sports = Object.values(Sport);
  await prisma.$transaction(
    sports.map((sport) =>
      prisma.sportConfig.upsert({
        where: { sport },
        create: { sport, enabled: true },
        update: {},
      }),
    ),
  );
}

async function readSportConfigs(): Promise<SportConfigRow[]> {
  await ensureSportRows();
  return prisma.sportConfig.findMany({ orderBy: { sport: "asc" } });
}

export const getSportConfigsCached = unstable_cache(readSportConfigs, ["admin:sports:v1"], {
  revalidate: 60,
  tags: ["admin:catalog"],
});

export async function getEnabledSports(): Promise<Sport[]> {
  const rows = await getSportConfigsCached();
  return rows.filter((r) => r.enabled).map((r) => r.sport);
}

export async function isSportEnabled(sport: Sport): Promise<boolean> {
  await ensureSportRows();
  const row = await prisma.sportConfig.findUnique({ where: { sport }, select: { enabled: true } });
  return row?.enabled ?? true;
}
