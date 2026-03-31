import Link from "next/link";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function DashboardShell({
  user,
}: {
  user: { name: string | null; email: string | null; image: string | null };
}) {
  // Temporary momentum heuristic until we wire real streak/ELO/activity.
  // Computes a 0..100 score based on profile completeness.
  const momentum = (() => {
    let score = 0;
    if (user.email) score += 34;
    if (user.name) score += 33;
    if (user.image) score += 33;
    return Math.max(0, Math.min(100, score));
  })();

  return (
    <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd]">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <Link href="/" className="text-xl font-black italic tracking-tighter">
          Rivaly
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{user.name ?? "Agent"}</div>
            <div className="text-xs text-white/60">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            Dashboard
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Welcome to Rivaly.
          </h1>
          <p className="mt-2 text-sm text-white/70 max-w-2xl">
            This is the authenticated foundation. Next up: groups, predictions, matches, and
            leaderboards.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#111417] p-5">
            <div className="text-sm font-semibold">Momentum</div>
            <div className="mt-1 text-xs text-white/60">
              Placeholder for streaks / ELO / daily activity.
            </div>
            <div className="mt-4">
              <ProgressBar value={momentum} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#111417] p-5">
            <div className="text-sm font-semibold">Next Match</div>
            <div className="mt-1 text-xs text-white/60">Connect real data later.</div>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
              No matches yet.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
