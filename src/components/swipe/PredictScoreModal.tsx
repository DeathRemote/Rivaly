"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { SwipeMatch } from "@/lib/swipe-data";

export function PredictScoreModal({
  open,
  onClose,
  match,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  match: SwipeMatch | null;
  onConfirm: (homeScore: number, awayScore: number) => void;
}) {
  const [homeScore, setHomeScore] = useState(1);
  const [awayScore, setAwayScore] = useState(1);

  const matchKey = useMemo(() => match?.matchId ?? "none", [match?.matchId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Predict exact score"
      description={
        match
          ? `${match.home.shortName ?? match.home.name} vs ${match.away.shortName ?? match.away.name}`
          : undefined
      }
    >
      {/* key forces local state reset when switching matches */}
      <div key={matchKey} className="contents">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 mb-2">
            Home
          </div>
          <input
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(Number(e.target.value))}
            className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white focus:outline-none focus:ring-2 focus:ring-lime-400/50"
          />
        </label>
        <label className="block">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 mb-2">
            Away
          </div>
          <input
            type="number"
            min={0}
            max={99}
            value={awayScore}
            onChange={(e) => setAwayScore(Number(e.target.value))}
            className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white focus:outline-none focus:ring-2 focus:ring-lime-400/50"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-4 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(homeScore, awayScore)}
          className="h-11 px-5 rounded-xl bg-lime-300 text-black font-black uppercase tracking-[0.18em] text-xs hover:brightness-110"
        >
          Confirm
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        Tip: Swipe is for fast picks. Edit later from the group Matches tab.
      </p>
      </div>
    </Modal>
  );
}
