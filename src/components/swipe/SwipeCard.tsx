"use client";

import { useMemo, useRef, useState } from "react";

import type { SwipeMatch } from "@/lib/swipe-data";
import { cn } from "@/lib/cn";

export function SwipeCard({
  match,
  disabled,
  onSwipeLeft,
  onSwipeRight,
  onPredictScore,
  onSkip,
  animDirection,
}: {
  match: SwipeMatch;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPredictScore?: () => void;
  onSkip?: () => void;
  animDirection?: "left" | "right" | "down" | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const kickoff = useMemo(() => new Date(match.kickoffAt), [match.kickoffAt]);
  const lockAt = useMemo(() => new Date(match.lockAt), [match.lockAt]);

  const overlay = useMemo(() => {
    if (!drag.active) return null;
    if (Math.abs(drag.x) < 24) return null;
    return drag.x < 0
      ? { label: "HOME WIN", tone: "lime" as const, corner: "left" as const }
      : { label: "AWAY WIN", tone: "cyan" as const, corner: "right" as const };
  }, [drag]);

  const style = useMemo(() => {
    if (animDirection) {
      const x = animDirection === "left" ? -420 : animDirection === "right" ? 420 : 0;
      const y = animDirection === "down" ? 280 : -20;
      const r = animDirection === "left" ? -14 : animDirection === "right" ? 14 : 0;
      return {
        transform: `translate(${x}px, ${y}px) rotate(${r}deg)`,
        transition: "transform 260ms ease, opacity 260ms ease",
        opacity: 0,
      } as const;
    }

    const rot = drag.x / 22;

    return {
      transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`,
      transition: drag.active ? "none" : "transform 180ms ease",
    } as const;
  }, [drag, animDirection]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full w-full rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden",
        "shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
        disabled && "opacity-70",
      )}
      style={style}
      onPointerDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setDrag({ x: 0, y: 0, active: true });
      }}
      onPointerMove={(e) => {
        if (disabled) return;
        if (!drag.active) return;
        setDrag((d) => ({ ...d, x: d.x + e.movementX, y: d.y + e.movementY }));
      }}
      onPointerUp={() => {
        if (disabled) return;
        const threshold = 120;
        const x = drag.x;

        setDrag({ x: 0, y: 0, active: false });

        if (x <= -threshold) onSwipeLeft?.();
        else if (x >= threshold) onSwipeRight?.();
      }}
      onPointerCancel={() => setDrag({ x: 0, y: 0, active: false })}
    >
      <div className="relative h-full p-6 sm:p-8 flex flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-[120px]" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-[120px]" />

        {/* Swipe overlay */}
        {overlay ? (
          <div
            className={cn(
              "pointer-events-none absolute top-6 z-20 rounded-2xl px-4 py-2",
              "text-[10px] font-black uppercase tracking-[0.28em]",
              overlay.corner === "left" ? "left-6" : "right-6",
              overlay.tone === "lime" ? "bg-lime-300 text-black" : "bg-cyan-300 text-black",
            )}
          >
            {overlay.label}
          </div>
        ) : null}

        <div className={cn(
          "flex items-start justify-between gap-3 pt-12",
          "flex-col sm:flex-row sm:items-center",
        )}>
          <span className={cn(
            "inline-flex items-center justify-center",
            "h-7 px-3 rounded-full",
            "border border-white/10 bg-black/25",
            "text-[10px] font-black uppercase tracking-[0.22em] text-white/70",
          )}>
            Open now
          </span>

          <span className={cn(
            "text-[10px] font-black uppercase tracking-[0.22em] text-white/40",
            "sm:text-right",
          )}>
            <span className="block sm:inline">Locks</span>
            <span className="block sm:inline sm:ml-2">
              {lockAt.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </span>
        </div>

        <div className="mt-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            {match.competitionLabel}
          </div>

          <div className="mt-3">
            {/* Mobile: stacked to prevent overflow. Desktop+: side-by-side */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5">
              <div className="min-w-0 max-w-full text-center">
                <div className="font-display text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tight text-white break-words">
                  {match.home.shortName ?? match.home.name}
                </div>
              </div>

              <div className="font-display text-xl md:text-2xl font-black italic text-white/25">VS</div>

              <div className="min-w-0 max-w-full text-center">
                <div className="font-display text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tight text-white break-words">
                  {match.away.shortName ?? match.away.name}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm font-medium text-white/60">
            {kickoff.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="mt-auto" />

        <div className="mt-6">
          <button
            type="button"
            disabled={disabled}
            onClick={onPredictScore}
            className={cn(
              "w-full h-12 rounded-2xl",
              "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]",
              "text-xs font-black uppercase tracking-[0.22em]",
              "shadow-[0_0_24px_rgba(202,253,0,0.16)]",
              "hover:brightness-110 active:scale-[0.99] transition",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            Predict Score
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={onSkip}
            className={cn(
              "mt-3 w-full h-11 rounded-2xl border border-white/10 bg-black/25",
              "text-xs font-black uppercase tracking-[0.22em] text-white/70",
              "hover:bg-white/5 active:scale-[0.99] transition",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
