import Link from "next/link";
import {
  Shield,
  LayoutDashboard,
  ArrowUpDown,
  Users,
  User,
  BadgeCheck,
  Settings,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { cn } from "@/lib/cn";
import type { DashboardNavItem } from "@/features/dashboard/mock";
import { SidebarAd } from "@/components/ads/SidebarAd";
import { UserBadge } from "@/components/dashboard/UserBadge";

type SidebarTable = {
  seasonId: string;
  title: string;
  rows: Array<{ teamId: string; teamName: string; position: number; points: number }>;
};

async function getSidebarTables(userId: string): Promise<SidebarTable[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: {
      competitionSeasonId: true,
      competitionSeason: { select: { id: true, seasonLabel: true, competition: { select: { name: true } } } },
    },
  });

  const seasons = groups
    .map((g) => g.competitionSeason)
    .filter(Boolean) as Array<{ id: string; seasonLabel: string; competition: { name: string } }>;

  // Only show a couple of relevant tables to keep the sidebar clean.
  const unique = new Map<string, { id: string; seasonLabel: string; competition: { name: string } }>();
  for (const s of seasons) {
    if (!unique.has(s.id)) unique.set(s.id, s);
  }

  const seasonList = [...unique.values()].slice(0, 2);
  if (seasonList.length === 0) return [];

  const rows = await prisma.standingsRow.findMany({
    where: { competitionSeasonId: { in: seasonList.map((s) => s.id) } },
    orderBy: { position: "asc" },
    take: 40,
    select: {
      competitionSeasonId: true,
      teamId: true,
      position: true,
      points: true,
      team: { select: { name: true, shortName: true } },
    },
  });

  const bySeason = new Map<string, SidebarTable>();
  for (const s of seasonList) {
    bySeason.set(s.id, {
      seasonId: s.id,
      title: `${s.competition.name} ${s.seasonLabel}`,
      rows: [],
    });
  }

  for (const r of rows) {
    const table = bySeason.get(r.competitionSeasonId);
    if (!table) continue;
    if (table.rows.length >= 5) continue;

    table.rows.push({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: r.position,
      points: r.points,
    });
  }

  return [...bySeason.values()].filter((t) => t.rows.length > 0);
}

function iconForKey(key: DashboardNavItem["key"]) {
  switch (key) {
    case "dashboard":
      return LayoutDashboard;
    case "swipe":
      return ArrowUpDown;
    case "groups":
      return Users;
    case "profile":
      return User;
    case "settings":
      return Settings;
    case "admin":
      return BadgeCheck;
    default:
      return Shield;
  }
}

export async function DashboardSidebar({
  items,
  activeKey,
  user,
}: {
  items: DashboardNavItem[];
  activeKey: DashboardNavItem["key"];
  user: { name: string; image: string | null; rankLabel: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;

  const tables = userId ? await getSidebarTables(userId) : [];

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 xl:w-72 lg:flex-col lg:bg-background lg:pt-20">
      <div className="px-5 xl:px-6 mb-6">
        <UserBadge name={user.name} rankLabel={user.rankLabel} image={user.image} />
      </div>

      <nav className="flex-1 space-y-1" aria-label="Sidebar">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = iconForKey(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-5 py-3 xl:gap-4 xl:px-6 xl:py-4",
                "font-display text-xs xl:text-sm font-bold uppercase tracking-[0.18em]",
                "transition-all duration-300",
                active
                  ? "bg-lime-300 text-black rounded-r-full shadow-[4px_0px_0px_0px_theme(colors.lime.100)]"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-lime-100 hover:translate-x-1 rounded-r-full",
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-black" : "text-white/60 group-hover:text-lime-100")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {tables.length ? (
        <div className="px-5 xl:px-6 pb-6">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            League tables
          </div>
          <div className="space-y-4">
            {tables.map((t) => (
              <div key={t.seasonId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  {t.title}
                </div>
                <ol className="space-y-1">
                  {t.rows.map((r) => (
                    <li key={r.teamId} className="flex items-center justify-between gap-2 text-xs text-white/65">
                      <span className="min-w-0 truncate">
                        <span className="text-white/35 mr-2 tabular-nums">{r.position}</span>
                        {r.teamName}
                      </span>
                      <span className="tabular-nums text-white/50">{r.points} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeKey !== "swipe" ? (
        <div className="p-5 xl:p-6">
          <SidebarAd />
        </div>
      ) : null}
    </aside>
  );
}
