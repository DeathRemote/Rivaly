"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

export function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-[0px_24px_48px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-[110px]" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-[110px]" />

      <div className="relative mx-auto max-w-lg">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
          Competitive Arena
        </div>
        <h2 className="font-display text-3xl font-black italic tracking-tight text-lime-100">
          You&apos;re not in any groups yet
        </h2>
        <p className="mt-3 text-sm font-medium text-white/60">
          Join a group or create your own to start competing.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/groups/join"
            className={cn(
              "inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-6 py-3",
              "text-xs font-black uppercase tracking-[0.22em] text-white/80",
              "transition hover:bg-white/5 hover:text-lime-100",
            )}
          >
            Join Group
          </Link>
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-6 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "transition hover:brightness-105 active:scale-[0.99]",
              )}
            >
              Create Group
            </button>
          ) : (
            <Link
              href="/groups?create=1"
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-6 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "transition hover:brightness-105 active:scale-[0.99]",
              )}
            >
              Create Group
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
