import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTableSeasonsForUser, type TablesSeasonOption } from "@/lib/tables-data";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TablesPageClient } from "@/components/tables/TablesPageClient";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/tables");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/tables");

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  let seasons: TablesSeasonOption[] = [];
  let seasonsError: string | null = null;

  try {
    seasons = await getTableSeasonsForUser(userId);
  } catch (e) {
    seasonsError = e instanceof Error ? e.message : "Tables temporarily unavailable.";
    console.warn("[tables] seasons load failed", seasonsError);
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
      <TablesPageClient seasons={seasons} error={seasonsError} />
    </DashboardLayout>
  );
}
