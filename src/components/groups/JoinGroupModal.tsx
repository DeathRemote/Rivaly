"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/groups/ModalShell";
import { joinGroupAction, type JoinGroupResult } from "@/app/groups/actions";

const INVITE_CODE_LENGTH = 8;

export function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinGroupResult | null>(null);

  const normalized = useMemo(() => normalizeInviteCode(code), [code]);

  const canSubmit = useMemo(() => {
    return normalized.length === INVITE_CODE_LENGTH && !pending;
  }, [normalized, pending]);

  function resetAndClose() {
    setCode("");
    setError(null);
    setResult(null);
    onClose();
  }

  async function onSubmit() {
    setError(null);
    setResult(null);

    if (normalized.length !== INVITE_CODE_LENGTH) {
      setError(`Invite code must be ${INVITE_CODE_LENGTH} characters.`);
      return;
    }

    startTransition(async () => {
      const res = await joinGroupAction({ inviteCode: normalized });
      setResult(res);

      if (!res.ok) {
        setError(res.error);
        return;
      }

      router.refresh();
    });
  }

  const success = result?.ok === true;

  return (
    <ModalShell
      open={open}
      title={success ? "Joined" : "Join a Group"}
      subtitle={
        success
          ? "You’re in. The arena is live."
          : `Enter the ${INVITE_CODE_LENGTH}-character code shared by your friends to unlock exclusive leagues and head‑to‑head predictions.`
      }
      onClose={resetAndClose}
      variant="centered"
      footer={
        success ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={resetAndClose}
              className={cn(
                "h-14 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "hover:brightness-105 transition active:scale-[0.99]",
              )}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                "h-16 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-sm font-black uppercase tracking-[0.18em] text-[#3a4a00]",
                "shadow-[0_12px_24px_rgba(202,253,0,0.18)]",
                "hover:shadow-[0_16px_32px_rgba(202,253,0,0.28)] hover:-translate-y-0.5",
                "active:translate-y-0 transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0",
              )}
            >
              {pending ? "Joining…" : "Join Group"}
            </button>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={pending}
              className={cn(
                "h-12 rounded-2xl text-xs font-black uppercase tracking-[0.22em]",
                "text-white/50 hover:text-white transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              Cancel and go back
            </button>
          </div>
        )
      }
    >
      {success ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <h2 className="font-display text-3xl font-black tracking-tight text-white">Joined</h2>
            <p className="mt-2 text-sm text-white/60">
              {result.groupName ? (
                <>
                  You joined <span className="text-lime-100">{result.groupName}</span>.
                </>
              ) : (
                "You joined the group."
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-lime-300/10 blur-[60px]" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-orange-300/10 blur-[60px]" />

          <div className="relative z-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10">
              <span className="text-3xl">👥</span>
            </div>

            <h2 className="font-display text-3xl font-black tracking-tight text-white">Join a Group</h2>
            <p className="mt-3 text-sm text-white/60 text-balance px-2">
              Enter the {INVITE_CODE_LENGTH}-character code shared by your friends to unlock
              exclusive leagues and head‑to‑head predictions.
            </p>

            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <div className="mb-8">
                <div className="relative">
                  <label className="absolute -top-2.5 left-6 z-10 rounded-full bg-[#1a1d23] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-lime-200">
                    Group invitation code
                  </label>
                  <input
                    value={code}
                    onChange={(e) => {
                      setError(null);
                      setCode(e.target.value);
                    }}
                    placeholder="e.g. AB12CD34"
                    maxLength={INVITE_CODE_LENGTH}
                    inputMode="text"
                    autoCapitalize="characters"
                    className={cn(
                      "h-16 w-full rounded-2xl bg-black/40 px-6 text-center",
                      "font-display text-2xl font-black italic tracking-[0.45em] text-lime-100",
                      "uppercase placeholder:text-white/20",
                      "border border-white/10 focus:outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20",
                      "focus:shadow-[0_0_20px_rgba(202,253,0,0.15)] transition-all",
                    )}
                  />
                </div>

                <p className="mt-4 text-[11px] text-white/40 flex items-center justify-center gap-2">
                  <span aria-hidden>ⓘ</span>
                  Valid for 24 hours after being generated by host.
                </p>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
                    {error}
                  </div>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function normalizeInviteCode(raw: string) {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}
