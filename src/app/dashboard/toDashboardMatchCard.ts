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
  const windowMs = 24 * 60 * 60 * 1000;
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
      label: "KICKOFF WINDOW",
      valueLabel: msToLock > 0 ? `${Math.ceil(msToLock / (60 * 1000))}m` : "Now",
      value: Math.max(5, Math.min(100, progress)),
      color: "orange",
    },
  };
}
