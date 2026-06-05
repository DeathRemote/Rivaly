import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getGroupsForUser } from "@/lib/groups-backend";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { type GroupCardData } from "@/components/groups/GroupCard";
import { GroupsPageClient } from "@/components/groups/GroupsPageClient";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

type TabKey = "my" | "public";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; create?: string; join?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups");

  const sp = await searchParams;
  const tab = (sp.tab === "public" ? "public" : "my") as TabKey;
  const create = sp.create === "1";
  const join = sp.join === "1";

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: accountTierLabel(session.user.tier),
  };

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/groups");

  const data = await getGroupsForUser(userId, tab);

  const groups = (data as any).groups ?? [];
  const yourPublicGroups = (data as any).yourPublicGroups ?? [];
  const otherPublicGroups = (data as any).otherPublicGroups ?? [];

  const hasGroups = tab === "my" ? groups.length > 0 : true;

  return (
    <DashboardLayout
      sideNavItems={getSideNavItems({ isAdmin })}
      activeKey="groups"
      user={user}
    >
      <GroupsPageClient
        tab={tab}
        hasGroups={hasGroups}
        groups={groups}
        yourPublicGroups={tab === "public" ? yourPublicGroups : undefined}
        otherPublicGroups={tab === "public" ? otherPublicGroups : undefined}
        initialCreateOpen={create}
        initialJoinOpen={join}
      />
    </DashboardLayout>
  );
}
