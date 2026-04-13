"use client";

import { useEffect } from "react";

export default function GroupDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[groups/[groupId]] route error", error);
  }, [error]);

  const msg = error?.message ?? "Unknown error";

  return (
    <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">Debug</div>
        <h1 className="mt-2 font-display text-3xl font-black italic tracking-tight text-white">
          This page couldn’t load
        </h1>

        <div className="mt-6 space-y-3 text-sm text-white/70">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Message</div>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/80">
              {msg}
            </pre>
          </div>

          {error?.digest ? (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Digest</div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/80">
                {error.digest}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 hover:bg-white/15"
          >
            Retry
          </button>
          <a
            href="/groups"
            className="rounded-xl border border-white/10 bg-black/20 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 hover:bg-white/5"
          >
            Back to groups
          </a>
        </div>

        <div className="mt-6 text-[11px] text-white/40">
          Temporary debug screen — remove after we fix the underlying issue.
        </div>
      </div>
    </div>
  );
}
