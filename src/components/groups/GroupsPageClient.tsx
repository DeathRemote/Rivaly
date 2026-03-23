"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import { EmptyState } from "@/components/groups/EmptyState";
import { GroupCard, type GroupCardData } from "@/components/groups/GroupCard";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { JoinGroupModal } from "@/components/groups/JoinGroupModal";

type TabKey = "my" | "public";

export function GroupsPageClient({
  tab,
  hasGroups,
  groups,
  initialCreateOpen,
  initialJoinOpen,
}: {
  tab: TabKey;
  hasGroups: boolean;
  groups: GroupCardData[];
  initialCreateOpen?: boolean;
  initialJoinOpen?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(Boolean(initialCreateOpen));
  const [joinOpen, setJoinOpen] = useState(Boolean(initialJoinOpen));

  const title = useMemo(() => {
    return tab === "my" ? "My Groups" : "Public Groups";
  }, [tab]);

  return (
    <>
      <section className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
            Competitive Arena
          </span>
          <h1 className="font-display text-5xl font-black tracking-tighter text-white md:text-6xl">
            GROUPS <span className="text-lime-100 italic">{title.toUpperCase()}</span>
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
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className={cn(
                "inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-white/80",
                "transition hover:bg-white/5 hover:text-lime-100",
              )}
            >
              Join Group
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-4 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "transition hover:brightness-105 active:scale-[0.99]",
              )}
            >
              Create Group
            </button>
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
            <EmptyState onJoin={() => setJoinOpen(true)} onCreate={() => setCreateOpen(true)} />
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
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
