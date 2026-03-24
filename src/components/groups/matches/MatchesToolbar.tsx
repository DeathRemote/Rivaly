"use client";

import { cn } from "@/lib/cn";
import type { MatchesView, PhaseType } from "@/components/groups/matches/types";

export function MatchesToolbar({
  phaseType,
  view,
  onViewChange,
}: {
  phaseType: PhaseType;
  view: MatchesView;
  onViewChange: (v: MatchesView) => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
          Match Center
        </div>
        <h2 className="mt-2 font-display text-3xl font-black italic tracking-tight text-white">
          Matches
          <span className="ml-3 text-lime-100">{phaseTypeLabel(phaseType)}</span>
        </h2>
        <p className="mt-2 text-sm font-medium text-white/60">
          Predict before the lock hits. Your picks are scoped to this group.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-1">
          <Pill active={view === "kickoff"} onClick={() => onViewChange("kickoff")}>
            Kickoff
          </Pill>
          <Pill active={view === "upcoming"} onClick={() => onViewChange("upcoming")}>
            Upcoming
          </Pill>
          <Pill active={view === "completed"} onClick={() => onViewChange("completed")}>
            Completed
          </Pill>
        </div>

        <button
          type="button"
          className={cn(
            "rounded-xl border border-white/10 bg-black/20 px-5 py-3",
            "text-xs font-black uppercase tracking-[0.22em] text-white/70",
            "transition hover:bg-white/5 hover:text-white",
          )}
        >
          This week
        </button>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-5 py-3 text-xs font-black uppercase tracking-[0.22em] transition",
        active
          ? "bg-white/10 text-lime-100 shadow-sm"
          : "text-white/50 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function phaseTypeLabel(t: PhaseType) {
  if (t === "GROUP_STAGE") return "Group Stage";
  if (t === "KNOCKOUT") return "Knockouts";
  return "League";
}
