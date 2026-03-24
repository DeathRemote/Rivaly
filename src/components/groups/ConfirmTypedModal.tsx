"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/groups/ModalShell";

export function ConfirmTypedModal({
  open,
  onClose,
  title,
  subtitle,
  confirmWord,
  confirmLabel,
  confirmTone = "danger",
  onConfirm,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  confirmWord: string;
  confirmLabel: string;
  confirmTone?: "danger" | "neutral";
  onConfirm: () => void;
  pending?: boolean;
}) {
  const [value, setValue] = useState("");

  const canConfirm = useMemo(() => value.trim().toUpperCase() === confirmWord.toUpperCase(), [value, confirmWord]);

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={() => {
        setValue("");
        onClose();
      }}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setValue("");
              onClose();
            }}
            disabled={pending}
            className={cn(
              "flex-1 h-14 rounded-xl px-8",
              "border border-white/10 bg-black/20",
              "text-xs font-black uppercase tracking-[0.22em] text-white/60",
              "hover:bg-white/5 hover:text-white transition",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || pending}
            className={cn(
              "flex-1 h-14 rounded-xl",
              "text-xs font-black uppercase tracking-[0.22em]",
              confirmTone === "danger"
                ? "border border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                : "border border-white/10 bg-white/10 text-white hover:bg-white/15",
              "transition",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
            Type <span className="text-white">{confirmWord.toUpperCase()}</span> to confirm
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmWord.toUpperCase()}
            className={cn(
              "mt-3 h-12 w-full rounded-xl bg-black/30 px-4",
              "text-sm font-black tracking-[0.12em] text-white placeholder:text-white/25",
              "border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-300/30",
            )}
          />
        </div>

        <p className="text-sm text-white/60">
          This action can’t be undone.
        </p>
      </div>
    </ModalShell>
  );
}
