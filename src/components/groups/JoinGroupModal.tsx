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
          : `Enter the ${INVITE_CODE_LENGTH}-character code shared by your friends to unlock the group.`
      }
      onClose={resetAndClose}
      footer={
        success ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={resetAndClose}
              className={cn(
                "flex-1 h-14 rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "hover:brightness-105 transition active:scale-[0.99]",
              )}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                "h-14 rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "shadow-[0_0_20px_rgba(202,253,0,0.25)]",
                "hover:shadow-[0_0_30px_rgba(202,253,0,0.4)] transition",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
              )}
            >
              {pending ? "Joining…" : "Join Group"}
            </button>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={pending}
              className={cn(
                "h-12 rounded-xl border border-white/10 bg-black/10",
                "text-xs font-black uppercase tracking-[0.22em] text-white/60",
                "hover:bg-white/5 hover:text-white transition",
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
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10">
            <span className="text-3xl">＋</span>
          </div>
          <div className="text-sm font-bold text-white/80">
            {result.groupName ? (
              <>
                You joined <span className="text-lime-100">{result.groupName}</span>.
              </>
            ) : (
              "You joined the group."
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
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
                "h-16 w-full rounded-2xl bg-black/30 px-6 text-center",
                "font-display text-2xl font-black italic tracking-[0.35em] text-lime-100",
                "uppercase placeholder:text-white/20",
                "border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-300/30",
              )}
            />
            <p className="text-[11px] text-white/40">
              Tip: codes are case-insensitive — we’ll normalize them.
            </p>
            {error ? (
              <div className="rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
                {error}
              </div>
            ) : null}
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function normalizeInviteCode(raw: string) {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}
