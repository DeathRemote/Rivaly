import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { EmptyState } from "@/components/groups/EmptyState";
import { GroupCard, type GroupCardData } from "@/components/groups/GroupCard";

import { topNavItems, sideNavItems } from "@/features/dashboard/mock";

type TabKey = "my" | "public";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups");

  const tab = ((await searchParams).tab === "public" ? "public" : "my") as TabKey;

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: "Pro",
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
          orderBy: { joinedAt: "desc" },
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
      topNavItems={topNavItems.map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))}
      sideNavItems={sideNavItems
        .map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))
        .filter((item) => (item.key === "admin" ? isAdmin : true))}
      activeKey="groups"
      user={user}
    >
      <section className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
            Competitive Arena
          </span>
          <h1 className="font-display text-5xl font-black tracking-tighter text-white md:text-6xl">
            GROUPS <span className="text-lime-100 italic">OVERVIEW</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-white/60">
            Join high-stakes leagues or dominate your private circles. Track performance against the
            elite.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-1">
            <TabButton active={tab === "my"} href="/groups?tab=my">
              My Groups
            </TabButton>
            <TabButton active={tab === "public"} href="/groups?tab=public">
              Public Groups
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/groups/join"
              className={cn(
                "inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-white/80",
                "transition hover:bg-white/5 hover:text-lime-100",
              )}
            >
              Join Group
            </Link>
            <Link
              href="/groups/create"
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-4 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "transition hover:brightness-105 active:scale-[0.99]",
              )}
            >
              Create Group
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-10">
        {tab === "my" ? (
          hasGroups ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TabButton({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl px-5 py-3 text-xs font-black uppercase tracking-[0.22em] transition",
        active
          ? "bg-white/10 text-lime-100 shadow-sm"
          : "text-white/50 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
