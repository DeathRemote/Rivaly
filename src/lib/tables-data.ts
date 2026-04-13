import { unstable_cache } from "next/cache";

import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";

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

async function _getTableSeasons(userId: string): Promise<TablesSeasonOption[]> {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) return [];

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });
  const res = await fetch(`${backendBase}/api/internal/table-seasons`, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { seasons: TablesSeasonOption[] };
  return data.seasons;
}

async function _getTablesForSeason(userId: string, seasonId: string): Promise<TablesPayload> {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) throw new Error("Backend not configured");

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });
  const res = await fetch(`${backendBase}/api/internal/tables?seasonId=${encodeURIComponent(seasonId)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as TablesPayload;
}

export const getTableSeasonsForUser = unstable_cache(
  async (userId: string) => _getTableSeasons(userId),
  ["tables-season-options"],
  { revalidate: 300 },
);

export const getTablesForSeason = unstable_cache(
  async (userId: string, seasonId: string) => _getTablesForSeason(userId, seasonId),
  ["tables-season"],
  { revalidate: 60 },
);
