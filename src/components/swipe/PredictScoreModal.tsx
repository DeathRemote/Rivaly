"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { SwipeMatch } from "@/lib/swipe-data";

function ScoreForm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (homeScore: number, awayScore: number) => Promise<void> | void;
}) {
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  return (
    <div className="contents">
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
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = e.target.value;
              setHomeScore(v === "" ? 0 : Number(v));
            }}
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
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = e.target.value;
              setAwayScore(v === "" ? 0 : Number(v));
            }}
            className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white focus:outline-none focus:ring-2 focus:ring-lime-400/50"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-4 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            await onConfirm(homeScore, awayScore);
          }}
          className="h-11 px-5 rounded-xl bg-lime-300 text-black font-black uppercase tracking-[0.18em] text-xs hover:brightness-110"
        >
          Confirm
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        Tip: Swipe is for fast picks. Edit later from the group Matches tab.
      </p>
    </div>
  );
}

export function PredictScoreModal({
  open,
  onClose,
  match,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  match: SwipeMatch | null;
  onConfirm: (homeScore: number, awayScore: number) => Promise<void> | void;
}) {
  const matchKey = useMemo(() => match?.matchId ?? "none", [match?.matchId]);

  const closeAndReset = () => {
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      title="Predict exact score"
      description={
        match
          ? `${match.home.shortName ?? match.home.name} vs ${match.away.shortName ?? match.away.name}`
          : undefined
      }
    >
      {/* key forces local state reset when switching matches */}
      <ScoreForm
        key={matchKey}
        onCancel={closeAndReset}
        onConfirm={onConfirm}
      />
    </Modal>
  );
}
