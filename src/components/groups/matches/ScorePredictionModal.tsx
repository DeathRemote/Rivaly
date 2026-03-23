"use client";

import { useMemo, useState, useTransition } from "react";

import { ModalShell } from "@/components/groups/ModalShell";
import { cn } from "@/lib/cn";

export function ScorePredictionModal({
  open,
  onClose,
  title,
  initialHome,
  initialAway,
  disabled,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initialHome: number;
  initialAway: number;
  disabled: boolean;
  onSave: (home: number, away: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);
  const [error, setError] = useState<string | null>(null);

  // This component is remounted with a changing `key` from the parent when opening,
  // so the inputs initialize from the latest saved prediction without effects.

  const canSave = useMemo(() => {
    return !disabled && !pending && Number.isInteger(home) && Number.isInteger(away) && home >= 0 && away >= 0;
  }, [disabled, pending, home, away]);

  return (
    <ModalShell
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Predict score"
      subtitle={title}
      variant="centered"
      footer={
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await onSave(home, away);
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save prediction");
                }
              });
            }}
            disabled={!canSave}
            className={cn(
              "h-16 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
              "text-sm font-black uppercase tracking-[0.18em] text-[#3a4a00]",
              "shadow-[0_12px_24px_rgba(202,253,0,0.18)]",
              "hover:shadow-[0_16px_32px_rgba(202,253,0,0.28)] hover:-translate-y-0.5",
              "active:translate-y-0 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0",
            )}
          >
            {pending ? "Saving…" : "Save score"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl text-xs font-black uppercase tracking-[0.22em] text-white/50 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {error ? (
            <div className="rounded-2xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
              {error}
            </div>
          ) : null}
        </div>
      }
    >
      <div className="text-center">
        <div className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
          Exact score
        </div>

        <div className="mx-auto grid max-w-sm grid-cols-3 items-center gap-3">
          <NumberBox value={home} onChange={setHome} disabled={disabled || pending} />
          <div className="text-2xl font-black text-white/30">–</div>
          <NumberBox value={away} onChange={setAway} disabled={disabled || pending} />
        </div>

        <p className="mt-4 text-[11px] text-white/35">
          Winner quick picks are shortcuts. This is for exact score.
        </p>
      </div>
    </ModalShell>
  );
}

function NumberBox({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={cn(
        "h-16 rounded-2xl bg-black/60 text-center",
        "font-display text-3xl font-black italic tracking-tight text-lime-100",
        "border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-300/20",
        "disabled:opacity-50",
      )}
    />
  );
}
