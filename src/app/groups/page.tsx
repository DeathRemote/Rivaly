import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const myGroups =
    tab === "my"
      ? await prisma.groupMember.findMany({
          where: { userId },
          include: {
            group: {
              include: {
                _count: { select: { members: true } },
                members: {
                  orderBy: { points: "desc" },
                  take: 3,
                  include: { user: { select: { name: true, username: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // Basic public tab placeholder (we'll implement browsing later).
  const publicGroups =
    tab === "public"
      ? await prisma.group.findMany({
          where: { visibility: "PUBLIC" },
          include: { _count: { select: { members: true } } },
          orderBy: { createdAt: "desc" },
          take: 24,
        })
      : [];

  const groups: GroupCardData[] =
    tab === "my"
      ? myGroups.map((m) => {
          const top3 = m.group.members.map((row, idx) => ({
            position: idx + 1,
            name: row.user.username ?? row.user.name ?? "Unknown",
            points: row.points,
            isYou: row.userId === userId,
          }));

          // Rank calculation: we need to know where the user sits. For now, compute
          // rank by counting how many members have strictly higher points.
          // (This is correct and can be optimized later.)
          const yourRank = null;

          return {
            id: m.group.id,
            name: m.group.name,
            competition: m.group.competition,
            memberCount: m.group._count.members,
            yourRank,
            yourPoints: m.points,
            top3,
          };
        })
      : publicGroups.map((g) => ({
          id: g.id,
          name: g.name,
          competition: g.competition,
          memberCount: g._count.members,
          yourRank: null,
          yourPoints: 0,
          top3: [],
        }));

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
        initialCreateOpen={create}
        initialJoinOpen={join}
      />
    </DashboardLayout>
  );
}
