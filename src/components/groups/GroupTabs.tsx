"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

export type GroupTabKey = "leaderboard" | "predicted-table" | "matches" | "knockout" | "table";

export function GroupTabs({
  groupId,
  active,
  showPredictedTable,
}: {
  groupId: string;
  active: GroupTabKey;
  showPredictedTable?: boolean;
}) {
  const base = `/groups/${groupId}`;

  return (
    <div className="mb-8 border-b border-white/10">
      <div className="flex gap-8 overflow-x-auto px-2 scrollbar-none sm:gap-10">
        <Tab href={`${base}?tab=leaderboard`} active={active === "leaderboard"}>
          Leaderboard
        </Tab>
        {showPredictedTable ? (
          <Tab href={`${base}?tab=predicted-table`} active={active === "predicted-table"}>
            Predicted Table
          </Tab>
        ) : null}
        <Tab href={`${base}?tab=matches`} active={active === "matches"}>
          Matches
        </Tab>
        <Tab href={`${base}?tab=knockout`} active={active === "knockout"}>
          Knockout stage
        </Tab>
        <Tab href={`${base}?tab=table`} active={active === "table"}>
          Table
        </Tab>
      </div>
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
        "shrink-0 pb-4 font-display text-lg font-black tracking-tight transition",
        active ? "text-lime-100 border-b-2 border-lime-200" : "text-white/50 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
