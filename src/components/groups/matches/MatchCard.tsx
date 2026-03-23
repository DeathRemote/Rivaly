"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import type { MatchListItem, PhaseType } from "@/components/groups/matches/types";
import { MatchStatusBadge } from "@/components/groups/matches/MatchStatusBadge";
import { PredictionActionButton } from "@/components/groups/matches/PredictionActionButton";
import { ScorePredictionModal } from "@/components/groups/matches/ScorePredictionModal";
import { useNow } from "@/components/groups/matches/useNow";
import { saveGroupPredictionAction } from "@/app/groups/[groupId]/matches/actions";

export function MatchCard({
  match,
  groupId,
  phaseType,
}: {
  match: MatchListItem;
  groupId: string;
  phaseType: PhaseType;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openScore, setOpenScore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const now = useNow();

  const kickoff = useMemo(() => new Date(match.kickoffAt), [match.kickoffAt]);
  const lockAt = useMemo(() => new Date(match.lockAt), [match.lockAt]);

  const locked = useMemo(() => {
    if (match.status === "FINAL") return true;
    return now >= lockAt.getTime();
  }, [match.status, lockAt, now]);

  const currentHome = match.userPrediction?.homeScore ?? 0;
  const currentAway = match.userPrediction?.awayScore ?? 0;

  async function saveScore({
    homeScore,
    awayScore,
    source,
  }: {
    homeScore: number;
    awayScore: number;
    source: "QUICK_PICK" | "SCORE";
  }) {
    setInlineError(null);

    const res = await saveGroupPredictionAction({
      groupId,
      matchKey: match.id,
      phaseType,
      homeScore,
      awayScore,
      source,
    });

    if (!res.ok) {
      setInlineError(res.error);
      throw new Error(res.error);
    }

    router.refresh();
  }

  const quickPickSelected = (home: number, away: number) =>
    match.userPrediction?.homeScore === home && match.userPrediction?.awayScore === away;

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

      {inlineError ? (
        <div className="mt-5 rounded-2xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
          {inlineError}
        </div>
      ) : null}

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
        <PredictionActionButton
          match={match}
          onClick={() => {
            if (locked) return;
            setOpenScore(true);
          }}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
          Quick pick
        </div>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={locked || pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveScore({ homeScore: 3, awayScore: 0, source: "QUICK_PICK" });
                } catch {
                  // inline error already set
                }
              });
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em]",
              quickPickSelected(3, 0)
                ? "border-lime-300/30 bg-lime-300/10 text-lime-100"
                : "text-white/60 hover:bg-white/5 hover:text-white",
              (locked || pending) && "opacity-50 cursor-not-allowed",
            )}
          >
            Home
          </button>
          <button
            type="button"
            disabled={locked || pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveScore({ homeScore: 1, awayScore: 1, source: "QUICK_PICK" });
                } catch {
                  // inline error already set
                }
              });
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em]",
              quickPickSelected(1, 1)
                ? "border-lime-300/30 bg-lime-300/10 text-lime-100"
                : "text-white/60 hover:bg-white/5 hover:text-white",
              (locked || pending) && "opacity-50 cursor-not-allowed",
            )}
          >
            Draw
          </button>
          <button
            type="button"
            disabled={locked || pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveScore({ homeScore: 0, awayScore: 3, source: "QUICK_PICK" });
                } catch {
                  // inline error already set
                }
              });
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em]",
              quickPickSelected(0, 3)
                ? "border-lime-300/30 bg-lime-300/10 text-lime-100"
                : "text-white/60 hover:bg-white/5 hover:text-white",
              (locked || pending) && "opacity-50 cursor-not-allowed",
            )}
          >
            Away
          </button>
        </div>
      </div>

      <ScorePredictionModal
        open={openScore}
        onClose={() => setOpenScore(false)}
        title={`${match.home.name} vs ${match.away.name}`}
        initialHome={currentHome}
        initialAway={currentAway}
        disabled={locked}
        onSave={async (homeScore, awayScore) => {
          await saveScore({ homeScore, awayScore, source: "SCORE" });
        }}
      />
    </article>
  );
}
