"use client";

import { useMemo, useState, useTransition } from "react";

import { SwipeCard } from "@/components/swipe/SwipeCard";
import { PredictScoreModal } from "@/components/swipe/PredictScoreModal";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { SwipeControls } from "@/components/swipe/SwipeControls";
import type { SwipeMatch } from "@/lib/swipe-data";
import { savePredictionAction } from "@/app/predictions/actions";

type Direction = "left" | "right" | "down" | "up";

const QUICK = {
  home: { homeScore: 2, awayScore: 1 },
  draw: { homeScore: 1, awayScore: 1 },
  away: { homeScore: 1, awayScore: 2 },
};

export function SwipePageClient({ initialMatches }: { initialMatches: SwipeMatch[] }) {
  const [pending, startTransition] = useTransition();

  const [stack, setStack] = useState<SwipeMatch[]>(initialMatches);
  const top = stack[0] ?? null;

  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreFor, setScoreFor] = useState<SwipeMatch | null>(null);

  const [anim, setAnim] = useState<{ matchId: string; dir: Direction } | null>(null);
  const [dragging, setDragging] = useState(false);
  const canInteract = !pending && !anim;

  const nextUpLabel = useMemo(() => {
    const remaining = stack.length;
    if (remaining <= 1) return "";
    return `${remaining - 1} more`;
  }, [stack.length]);

  function removeTopAfter(dir: Direction) {
    if (!top) return;
    setAnim({ matchId: top.matchId, dir });

    window.setTimeout(() => {
      setStack((s) => s.filter((x) => x.matchId !== top.matchId));
      setAnim(null);
    }, 260);
  }

  function skipTop() {
    if (!top) return;
    // Move to the end. No save.
    setAnim({ matchId: top.matchId, dir: "down" });
    window.setTimeout(() => {
      setStack((s) => (s.length <= 1 ? s : [...s.slice(1), s[0]!].filter(Boolean)));
      setAnim(null);
    }, 220);
  }

  const [advancesOpen, setAdvancesOpen] = useState(false);
  const [advancesFor, setAdvancesFor] = useState<{
    match: SwipeMatch;
    homeScore: number;
    awayScore: number;
    source: "QUICK_PICK" | "SCORE";
  } | null>(null);

  async function submitQuickPick(match: SwipeMatch, pick: "home" | "draw" | "away") {
    const score = QUICK[pick];

    // Knockout draw: require choosing who advances.
    if (pick === "draw" && match.isKnockout) {
      setAdvancesFor({ match, homeScore: score.homeScore, awayScore: score.awayScore, source: "QUICK_PICK" });
      setAdvancesOpen(true);
      return;
    }

    const res = await savePredictionAction({
      matchId: match.matchId,
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      source: "QUICK_PICK",
    });

    if (!res.ok) throw new Error(res.error);

    removeTopAfter(pick === "home" ? "left" : pick === "away" ? "right" : "down");
  }

  async function submitExactScore(match: SwipeMatch, homeScore: number, awayScore: number) {
    // Knockout draw: require choosing who advances.
    if (match.isKnockout && homeScore === awayScore) {
      setAdvancesFor({ match, homeScore, awayScore, source: "SCORE" });
      setAdvancesOpen(true);
      return;
    }

    const res = await savePredictionAction({
      matchId: match.matchId,
      homeScore,
      awayScore,
      source: "SCORE",
    });

    if (!res.ok) throw new Error(res.error);

    const dir: Direction = homeScore > awayScore ? "left" : homeScore < awayScore ? "right" : "down";
    removeTopAfter(dir);
  }

  if (!top) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-lime-200">
          You’re all caught up
        </div>
        <h1 className="mt-3 font-display text-4xl font-black italic tracking-tight text-white">
          No matches to swipe
        </h1>
        <p className="mt-3 text-sm font-medium text-white/60 max-w-2xl">
          You’ve predicted every match currently open for kickoff. Come back later or use the Matches tab to review.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl xl:max-w-2xl h-[calc(100dvh-9rem)] sm:h-[680px] lg:h-[640px] xl:h-[740px] overflow-hidden sm:overflow-visible flex flex-col">
      {/* Desktop header only */}
      <div className="hidden sm:flex mb-4 lg:mb-3 xl:mb-5 items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
            Swipe mode
          </div>
          <h1 className="mt-2 font-display text-3xl xl:text-4xl font-black italic tracking-tight text-white">
            Lock picks fast
          </h1>
          <p className="mt-2 text-sm font-medium text-white/60">
            Swipe left = Home win. Swipe right = Away win. Draw is a button.
          </p>
        </div>

        {nextUpLabel ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              Up next
            </div>
            <div className="mt-1 font-display text-xl font-black text-lime-100">{nextUpLabel}</div>
          </div>
        ) : null}
      </div>

      <div className="relative flex-1 min-h-0 overflow-visible">
        {/* Background card: nearly hidden */}
        {dragging && stack[1] ? (
          <div className="absolute inset-0 translate-y-2 scale-[0.97] pointer-events-none">
            <SwipeCard match={stack[1]} disabled />
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] shadow-[0_18px_60px_rgba(0,0,0,0.45)]" />
          </div>
        ) : null}

        <div className="absolute inset-0">
          <SwipeCard
            match={top}
            disabled={!canInteract}
            animDirection={anim?.matchId === top.matchId ? anim.dir : null}
            onDragActiveChange={(active) => setDragging(active)}
            onSwipeLeft={() => {
              if (!canInteract) return;
              startTransition(async () => {
                try {
                  await submitQuickPick(top, "home");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to save prediction");
                }
              });
            }}
            onSwipeRight={() => {
              if (!canInteract) return;
              startTransition(async () => {
                try {
                  await submitQuickPick(top, "away");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to save prediction");
                }
              });
            }}
            onSwipeUp={() => {
              if (!canInteract) return;
              startTransition(async () => {
                try {
                  await submitQuickPick(top, "draw");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to save prediction");
                }
              });
            }}
            onSwipeDown={() => {
              if (!canInteract) return;
              startTransition(async () => {
                try {
                  await submitQuickPick(top, "draw");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to save prediction");
                }
              });
            }}
            onPredictScore={() => {
              if (!canInteract) return;
              setScoreFor(top);
              setScoreOpen(true);
            }}
            onSkip={() => {
              if (!canInteract) return;
              skipTop();
            }}
          />
        </div>
      </div>

      <SwipeControls
        disabled={!canInteract}
        onHome={() => {
          if (!canInteract) return;
          startTransition(async () => {
            try {
              await submitQuickPick(top, "home");
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save prediction");
            }
          });
        }}
        onDraw={() => {
          if (!canInteract) return;
          startTransition(async () => {
            try {
              await submitQuickPick(top, "draw");
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save prediction");
            }
          });
        }}
        onAway={() => {
          if (!canInteract) return;
          startTransition(async () => {
            try {
              await submitQuickPick(top, "away");
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save prediction");
            }
          });
        }}
      />

      <PredictScoreModal
        open={scoreOpen}
        onClose={() => setScoreOpen(false)}
        match={scoreFor}
        onConfirm={async (homeScore, awayScore) => {
          if (!scoreFor) return;
          try {
            await submitExactScore(scoreFor, homeScore, awayScore);
            setScoreOpen(false);
          } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to save prediction");
            throw e;
          }
        }}
      />

      <Modal
        open={advancesOpen}
        onClose={() => {
          setAdvancesOpen(false);
          setAdvancesFor(null);
        }}
        title="Draw predicted"
        description={
          advancesFor
            ? `Who advances? (${advancesFor.match.home.shortName ?? advancesFor.match.home.name} vs ${advancesFor.match.away.shortName ?? advancesFor.match.away.name})`
            : undefined
        }
      >
        {advancesFor ? (
          <div>
            <div className="text-[11px] text-white/50">
              You don’t need to predict the penalty score — just pick the team that goes through.
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!canInteract}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const advancesTeamId = advancesFor.match.homeTeamId;
                      if (!advancesTeamId) throw new Error("Missing homeTeamId for this match.");

                      const res = await savePredictionAction({
                        matchId: advancesFor.match.matchId,
                        homeScore: advancesFor.homeScore,
                        awayScore: advancesFor.awayScore,
                        advancesTeamId,
                        source: advancesFor.source,
                      });
                      if (!res.ok) throw new Error(res.error);

                      setAdvancesOpen(false);
                      setAdvancesFor(null);
                      removeTopAfter("down");
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Failed to save prediction");
                    }
                  });
                }}
                className={cn(
                  "h-12 rounded-2xl border border-white/10 bg-black/30",
                  "text-[10px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/5",
                  !canInteract && "opacity-50 cursor-not-allowed",
                )}
              >
                {advancesFor.match.home.shortName ?? advancesFor.match.home.name}
              </button>
              <button
                type="button"
                disabled={!canInteract}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const advancesTeamId = advancesFor.match.awayTeamId;
                      if (!advancesTeamId) throw new Error("Missing awayTeamId for this match.");

                      const res = await savePredictionAction({
                        matchId: advancesFor.match.matchId,
                        homeScore: advancesFor.homeScore,
                        awayScore: advancesFor.awayScore,
                        advancesTeamId,
                        source: advancesFor.source,
                      });
                      if (!res.ok) throw new Error(res.error);

                      setAdvancesOpen(false);
                      setAdvancesFor(null);
                      removeTopAfter("down");
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Failed to save prediction");
                    }
                  });
                }}
                className={cn(
                  "h-12 rounded-2xl border border-white/10 bg-black/30",
                  "text-[10px] font-black uppercase tracking-[0.22em] text-white/80 hover:bg-white/5",
                  !canInteract && "opacity-50 cursor-not-allowed",
                )}
              >
                {advancesFor.match.away.shortName ?? advancesFor.match.away.name}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
