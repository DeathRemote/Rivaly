"use client";

import { useTransition } from "react";

import { cn } from "@/lib/cn";
import type { GroupCardData } from "@/lib/groups-backend";

export function PublicGroupJoinCard({
  group,
  onJoin,
}: {
  group: GroupCardData;
  onJoin: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6",
        "shadow-[0px_24px_48px_rgba(0,0,0,0.35)]",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime-300/10 blur-[70px]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-black italic tracking-tight text-lime-100">
              {group.name}
            </h3>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                {group.competition}
              </span>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
              {group.memberCount} members
            </span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(onJoin)}
            className={cn(
              "h-12 w-full rounded-xl",
              "bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
              "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
              "hover:brightness-105 transition",
              pending && "opacity-60 cursor-not-allowed",
            )}
          >
            {pending ? "Joining…" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
