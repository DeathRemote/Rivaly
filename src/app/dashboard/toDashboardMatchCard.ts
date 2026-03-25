import type { MatchCard } from "@/features/dashboard/mock";

export function toDashboardMatchCard(m: {
  matchId: string;
  kickoffAt: string;
  lockAt: string;
  home: string;
  away: string;
}): MatchCard {
  const kickoff = new Date(m.kickoffAt);
  const lock = new Date(m.lockAt);

  const now = Date.now();
  const msToLock = Math.max(0, lock.getTime() - now);

  // We can’t reliably know the whole kickoff window length for every match here,
  // but we *can* show a clear "time remaining" signal.
  // Bar value: 0..100 based on 0..120 minutes remaining.
  const windowMs = 120 * 60 * 1000;
  const progress = 100 - Math.min(100, Math.round((msToLock / windowMs) * 100));

  return {
    id: m.matchId,
    badge: {
      label: `LOCKS ${lock.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
      variant: "time",
    },
    leagueLabel: kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    left: { name: m.home.toUpperCase(), sport: "soccer" },
    right: { name: m.away.toUpperCase(), sport: "soccer" },
    metric: {
      label: "LOCKS IN",
      valueLabel: msToLock <= 0 ? "LOCKED" : fmtDuration(msToLock),
      value: Math.max(5, Math.min(100, progress)),
      color: "orange",
    },
  };
}

function fmtDuration(ms: number) {
  const totalMin = Math.max(0, Math.ceil(ms / (60 * 1000)));
  if (totalMin < 1) return "Now";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
