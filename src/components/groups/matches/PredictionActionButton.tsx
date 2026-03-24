"use client";

import { useMemo } from "react";

import { useNow } from "@/components/groups/matches/useNow";

import { cn } from "@/lib/cn";
import type { MatchListItem } from "@/components/groups/matches/types";

export function PredictionActionButton({
  match,
  onClick,
}: {
  match: MatchListItem;
  onClick: () => void;
}) {
  const now = useNow();
  const visibleAt = Date.parse(match.visibleAt);
  const lockAt = Date.parse(match.lockAt);
  const kickoffAt = Date.parse(match.kickoffAt);

  const state = useMemo(() => {
    if (match.status === "FINAL") {
      return { label: "View result", sub: "Final", disabled: false, tone: "dim" as const };
    }
    if (now < visibleAt) {
      return { label: "Locked", sub: "Opens soon", disabled: true, tone: "dim" as const };
    }
    if (now >= lockAt) {
      return { label: "Locked", sub: "Prediction closed", disabled: true, tone: "dim" as const };
    }
    const hasPrediction =
      typeof match.userPrediction?.homeScore === "number" &&
      typeof match.userPrediction?.awayScore === "number";

    if (hasPrediction) {
      return { label: "Edit score", sub: "Exact score", disabled: false, tone: "lime" as const };
    }

    return { label: "Predict score", sub: "Exact score", disabled: false, tone: "orange" as const };
  }, [match.status, match.userPrediction?.homeScore, match.userPrediction?.awayScore, visibleAt, lockAt, now]);

  const countdown =
    now < visibleAt
      ? `${formatCountdown(visibleAt - now).replace("to lock", "to open")}`
      : now < lockAt
        ? formatCountdown(lockAt - now)
        : now < kickoffAt
          ? "Kickoff soon"
          : "In play";

  return (
    <button
      type="button"
      disabled={state.disabled}
      onClick={() => {
        if (!state.disabled) onClick();
      }}
      className={cn(
        "w-full rounded-2xl py-4",
        "text-xs font-black uppercase tracking-[0.22em]",
        "transition active:scale-[0.99]",
        state.tone === "orange" &&
          "bg-orange-300 text-black shadow-lg shadow-orange-300/10 hover:shadow-orange-300/20",
        state.tone === "lime" &&
          "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] shadow-[0_0_20px_rgba(202,253,0,0.18)] hover:shadow-[0_0_30px_rgba(202,253,0,0.28)]",
        state.tone === "dim" &&
          "border border-white/10 bg-black/20 text-white/50 hover:bg-white/5 disabled:hover:bg-black/20",
        state.disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <div>{state.label}</div>
      <div
        className={cn(
          "mt-1 text-[10px] font-black tracking-[0.18em]",
          state.tone === "dim" ? "text-white/30" : "text-black/50",
        )}
      >
        {state.sub} • {countdown}
      </div>
    </button>
  );
}

function formatCountdown(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m to lock`;
  return `${h}h ${m}m to lock`;
}
