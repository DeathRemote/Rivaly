import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TablesPageClient, type TablesPageTable } from "@/components/tables/TablesPageClient";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

type Season = { id: string; seasonLabel: string; competition: { name: string } };

async function getRelevantTablesUncached(userId: string): Promise<TablesPageTable[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: {
      competitionSeason: {
        select: {
          id: true,
          seasonLabel: true,
          competition: { select: { name: true } },
        },
      },
    },
  });

  const seasons = groups.map((g) => g.competitionSeason).filter(Boolean) as Season[];

  // Deduplicate by competition/season.
  const unique = new Map<string, Season>();
  for (const s of seasons) if (!unique.has(s.id)) unique.set(s.id, s);

  const seasonList = [...unique.values()];
  if (seasonList.length === 0) return [];

  const standings = await prisma.standingsRow.findMany({
    where: { competitionSeasonId: { in: seasonList.map((s) => s.id) } },
    orderBy: [
      { competitionSeasonId: "asc" },
      { points: "desc" },
      { goalsFor: "desc" },
      { goalsAgainst: "asc" },
      { team: { name: "asc" } },
    ],
    select: {
      competitionSeasonId: true,
      teamId: true,
      played: true,
      goalDifference: true,
      points: true,
      goalsFor: true,
      goalsAgainst: true,
      team: { select: { name: true, shortName: true } },
    },
  });

  const bySeason = new Map<string, TablesPageTable>();
  for (const s of seasonList) {
    bySeason.set(s.id, {
      seasonId: s.id,
      title: `${s.competition.name} ${s.seasonLabel}`,
      rows: [],
    });
  }

  for (const r of standings) {
    const t = bySeason.get(r.competitionSeasonId);
    if (!t) continue;
    // Position is derived from the sorted order (ties resolved by tiebreakers).
    t.rows.push({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: t.rows.length + 1,
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    });
  }

  return [...bySeason.values()].filter((t) => t.rows.length > 0);
}

const getRelevantTables = unstable_cache(
  async (userId: string) => getRelevantTablesUncached(userId),
  ["tables-page"],
  { revalidate: 120 },
);

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/tables");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/tables");

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  let tables: TablesPageTable[] = [];
  let tablesError: string | null = null;

  try {
    tables = await getRelevantTables(userId);
  } catch (e) {
    tablesError = e instanceof Error ? e.message : "Tables temporarily unavailable.";
    console.warn("[tables] load failed", tablesError);
  }

  return (
    <DashboardLayout
      sideNavItems={getSideNavItems({ isAdmin })}
      activeKey="tables"
      user={{
        name: session.user.username ?? session.user.name ?? "Kinetic Player",
        image: session.user.image ?? null,
        rankLabel: accountTierLabel(session.user.tier),
      }}
    >
      <TablesPageClient tables={tables} error={tablesError} />
    </DashboardLayout>
  );
}
