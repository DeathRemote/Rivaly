"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

export type GroupTabKey = "leaderboard" | "matches";

export function GroupTabs({ groupId, active }: { groupId: string; active: GroupTabKey }) {
  const base = `/groups/${groupId}`;

  return (
    <div className="mb-8 flex gap-10 border-b border-white/10 px-2">
      <Tab href={`${base}?tab=leaderboard`} active={active === "leaderboard"}>
        Leaderboard
      </Tab>
      <Tab href={`${base}?tab=matches`} active={active === "matches"}>
        Matches
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "pb-4 font-display text-lg font-black tracking-tight transition",
        active ? "text-lime-100 border-b-2 border-lime-200" : "text-white/50 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
