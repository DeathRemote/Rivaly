import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TablesPageClient, type TablesPageTable } from "@/components/tables/TablesPageClient";

import { getSideNavItems, getTopNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

type Season = { id: string; seasonLabel: string; competition: { name: string } };

async function getRelevantTables(userId: string): Promise<TablesPageTable[]> {
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
    orderBy: [{ competitionSeasonId: "asc" }, { position: "asc" }],
    select: {
      competitionSeasonId: true,
      teamId: true,
      position: true,
      played: true,
      goalDifference: true,
      points: true,
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
    t.rows.push({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: r.position,
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    });
  }

  return [...bySeason.values()].filter((t) => t.rows.length > 0);
}

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/tables");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/tables");

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const tables = await getRelevantTables(userId);

  return (
    <DashboardLayout
      topNavItems={getTopNavItems()}
      sideNavItems={getSideNavItems({ isAdmin })}
      activeKey="tables"
      user={{
        name: session.user.username ?? session.user.name ?? "Kinetic Player",
        image: session.user.image ?? null,
        rankLabel: accountTierLabel(session.user.tier),
      }}
    >
      <TablesPageClient tables={tables} />
    </DashboardLayout>
  );
}
