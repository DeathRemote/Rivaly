import { cn } from "@/lib/cn";
import type { MatchListItem } from "@/components/groups/matches/types";
import { MatchStatusBadge } from "@/components/groups/matches/MatchStatusBadge";
import { PredictionActionButton } from "@/components/groups/matches/PredictionActionButton";

export function MatchCard({ match }: { match: MatchListItem }) {
  const kickoff = new Date(match.kickoffAt);
  const lockAt = new Date(match.lockAt);

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lime-300/10 blur-[90px]" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-[90px]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              {match.phaseLabel}
            </span>
            {match.competitionLabel ? (
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                {match.competitionLabel}
              </span>
            ) : null}
          </div>

          <h3 className="font-display text-xl font-black italic tracking-tight text-white">
            {match.home.name}
            <span className="mx-2 text-white/20">vs</span>
            {match.away.name}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-white/50">
            <span>
              {kickoff.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-white/20">•</span>
            <span>Locks {lockAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>

            {match.userPrediction?.summary ? (
              <>
                <span className="text-white/20">•</span>
                <span className="text-lime-200/70">Your pick: {match.userPrediction.summary}</span>
              </>
            ) : null}
          </div>
        </div>

        <MatchStatusBadge
          status={match.userPrediction?.status ?? "NOT_PREDICTED"}
          matchStatus={match.status}
        />
      </div>

      {match.status === "FINAL" && match.result ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Final
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-sm font-black italic text-white">{match.home.name}</span>
            <span className="font-display text-2xl font-black text-white">
              {match.result.homeScore} - {match.result.awayScore}
            </span>
            <span className="font-display text-sm font-black italic text-white">{match.away.name}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <PredictionActionButton match={match} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {(["HOME", "DRAW", "AWAY"] as const).map((k) => (
          <div
            key={k}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em] text-white/50",
            )}
          >
            {k}
          </div>
        ))}
      </div>
    </article>
  );
}
