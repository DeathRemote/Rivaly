"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/groups/ModalShell";

export function InviteCodeModal({
  open,
  onClose,
  groupName,
  inviteCode,
}: {
  open: boolean;
  onClose: () => void;
  groupName: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onCopy() {
    startTransition(async () => {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Invite friends"
      subtitle={`Share this code to join “${groupName}”.`}
      variant="centered"
      footer={
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onCopy}
            disabled={pending}
            className={cn(
              "h-16 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
              "text-sm font-black uppercase tracking-[0.18em] text-[#3a4a00]",
              "shadow-[0_12px_24px_rgba(202,253,0,0.18)]",
              "hover:shadow-[0_16px_32px_rgba(202,253,0,0.28)] hover:-translate-y-0.5",
              "active:translate-y-0 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0",
            )}
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl text-xs font-black uppercase tracking-[0.22em] text-white/50 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="relative overflow-hidden text-center">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-lime-300/10 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-[80px]" />

        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-100 ring-1 ring-lime-300/20">
            <span className="text-2xl">🔗</span>
          </div>

          <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-lime-200">
            Invite code
          </div>
          <div
            className={cn(
              "mx-auto w-full rounded-xl bg-black/60 px-6 py-5",
              "font-display text-3xl font-black italic tracking-[0.4em] text-lime-100",
            )}
          >
            {inviteCode}
          </div>

          <p className="mt-4 text-[11px] text-white/35">
            Anyone with this code can join. (We can add expiration later.)
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
