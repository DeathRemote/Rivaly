"use client";

import { useMemo, useState, useTransition } from "react";
// Navigation refresh is not needed; we keep local prediction state for immediate UI updates.

import { cn } from "@/lib/cn";
import type { MatchListItem } from "@/components/groups/matches/types";
import { MatchStatusBadge } from "@/components/groups/matches/MatchStatusBadge";
import { PredictionActionButton } from "@/components/groups/matches/PredictionActionButton";
import { ScorePredictionModal } from "@/components/groups/matches/ScorePredictionModal";
import { useNow } from "@/components/groups/matches/useNow";
import { savePredictionAction } from "@/app/predictions/actions";

export function MatchCard({
  match,
}: {
  match: MatchListItem;
}) {
  // Local prediction state only (no router refresh).
  const [pending, startTransition] = useTransition();
  const [openScore, setOpenScore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState(match.userPrediction ?? null);

  const now = useNow();

  // Note: prediction state is owned locally (updated on save) to avoid full refresh.

  const kickoff = useMemo(() => new Date(match.kickoffAt), [match.kickoffAt]);
  const visibleAt = useMemo(() => new Date(match.visibleAt), [match.visibleAt]);
  const lockAt = useMemo(() => new Date(match.lockAt), [match.lockAt]);

  const openForPrediction = useMemo(() => {
    if (match.status === "FINAL") return false;
    return now >= visibleAt.getTime() && now < lockAt.getTime();
  }, [match.status, visibleAt, lockAt, now]);

  // For UI: disable prediction interactions when not open or when locked/final.
  const locked = useMemo(() => {
    if (match.status === "FINAL") return true;
    if (now >= lockAt.getTime()) return true;
    if (now < visibleAt.getTime()) return true;
    return false;
  }, [match.status, visibleAt, lockAt, now]);

  const hasPrediction = Boolean(
    prediction &&
      typeof prediction.homeScore === "number" &&
      typeof prediction.awayScore === "number",
  );

  const currentHome = prediction?.homeScore ?? 0;
  const currentAway = prediction?.awayScore ?? 0;
  const currentAdvances = prediction?.advancesTeamId
    ? prediction.advancesTeamId === match.homeTeamId
      ? "HOME"
      : prediction.advancesTeamId === match.awayTeamId
        ? "AWAY"
        : null
    : null;

  async function saveScore({
    homeScore,
    awayScore,
    advances,
    source,
  }: {
    homeScore: number;
    awayScore: number;
    advances?: "HOME" | "AWAY" | null;
    source: "QUICK_PICK" | "SCORE";
  }) {
    setInlineError(null);

    if (match.phaseType === "KNOCKOUT" && homeScore === awayScore) {
      if (!match.homeTeamId || !match.awayTeamId) {
        throw new Error("This knockout match is missing team ids; can’t save an advances pick.");
      }
    }

    const res = await savePredictionAction({
      matchId: match.id,
      homeScore,
      awayScore,
      advancesTeamId:
        match.phaseType === "KNOCKOUT" && homeScore === awayScore
          ? advances === "HOME"
            ? match.homeTeamId
            : advances === "AWAY"
              ? match.awayTeamId
              : undefined
          : undefined,
      source,
    });

    if (!res.ok) {
      setInlineError(res.error);
      throw new Error(res.error);
    }

    const baseSummary = `${res.prediction.homeScore}-${res.prediction.awayScore}`;
    setPrediction({
      status: "PREDICTED",
      summary:
        match.phaseType === "KNOCKOUT" &&
        res.prediction.homeScore === res.prediction.awayScore &&
        res.prediction.advancesTeamId
          ? `${baseSummary} (adv)`
          : baseSummary,
      homeScore: res.prediction.homeScore,
      awayScore: res.prediction.awayScore,
      advancesTeamId: res.prediction.advancesTeamId,
      source: res.prediction.source,
      updatedAt: res.prediction.updatedAt,
    });
  }

  const quickPickSelected = (home: number, away: number) =>
    prediction?.homeScore === home && prediction?.awayScore === away;

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
            {openForPrediction ? (
              <span>Locks {lockAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="text-white/20">🔒</span>
                Opens {visibleAt.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {hasPrediction ? (
              <>
                <span className="text-white/20">•</span>
                <span className="text-lime-200/70">Saved</span>
              </>
            ) : null}
          </div>
        </div>

        <MatchStatusBadge
          status={match.status === "FINAL" ? "COMPLETED" : hasPrediction ? "PREDICTED" : "NOT_PREDICTED"}
          matchStatus={match.status}
        />
      </div>

      {hasPrediction ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Your prediction
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-sm font-black italic text-white/80">
              {match.home.name}
            </span>
            <span className="font-display text-3xl font-black text-lime-100">
              {prediction?.homeScore} <span className="text-white/20">–</span> {prediction?.awayScore}
            </span>
            <span className="font-display text-sm font-black italic text-white/80">
              {match.away.name}
            </span>
          </div>
          <div className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            {prediction?.source === "QUICK_PICK" ? "Quick pick" : "Exact score"}
          </div>
        </div>
      ) : null}

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
          match={{ ...match, userPrediction: prediction ?? undefined }}
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
                  await saveScore({ homeScore: 2, awayScore: 1, source: "QUICK_PICK" });
                } catch {
                  // inline error already set
                }
              });
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em]",
              quickPickSelected(2, 1)
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
              // In knockout matches, a draw requires choosing who advances.
              if (match.phaseType === "KNOCKOUT") {
                setOpenScore(true);
                return;
              }

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
                  await saveScore({ homeScore: 1, awayScore: 2, source: "QUICK_PICK" });
                } catch {
                  // inline error already set
                }
              });
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-black/20 py-3 text-center",
              "text-[10px] font-black uppercase tracking-[0.22em]",
              quickPickSelected(1, 2)
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
        key={`${match.id}:${openScore ? "open" : "closed"}:${currentHome}-${currentAway}`}
        open={openScore}
        onClose={() => setOpenScore(false)}
        title={`${match.home.name} vs ${match.away.name}`}
        initialHome={currentHome}
        initialAway={currentAway}
        disabled={locked}
        isKnockout={match.phaseType === "KNOCKOUT"}
        homeTeamLabel={match.home.name}
        awayTeamLabel={match.away.name}
        initialAdvances={currentAdvances}
        onSave={async (homeScore, awayScore, advances) => {
          await saveScore({ homeScore, awayScore, advances, source: "SCORE" });
        }}
      />
    </article>
  );
}
