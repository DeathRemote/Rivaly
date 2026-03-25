"use client";

import { useMemo, useRef, useState } from "react";

import type { SwipeMatch } from "@/lib/swipe-data";
import { cn } from "@/lib/cn";

export function SwipeCard({
  match,
  disabled,
  onSwipeLeft,
  onSwipeRight,
  onHome,
  onDraw,
  onAway,
  onPredictScore,
  animDirection,
}: {
  match: SwipeMatch;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onHome?: () => void;
  onDraw?: () => void;
  onAway?: () => void;
  onPredictScore?: () => void;
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
      ? { label: "HOME", tone: "lime" as const }
      : { label: "AWAY", tone: "cyan" as const };
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
              "pointer-events-none absolute top-6 left-6 z-20 rounded-2xl px-4 py-2",
              "text-[10px] font-black uppercase tracking-[0.28em]",
              overlay.tone === "lime" ? "bg-lime-300 text-black" : "bg-cyan-300 text-black",
            )}
          >
            {overlay.label}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
            Open now
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Locks {lockAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="mt-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            {match.competitionLabel}
          </div>

          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-black italic tracking-tight text-white">
            {match.home.shortName ?? match.home.name}
            <span className="mx-3 text-white/20">vs</span>
            {match.away.shortName ?? match.away.name}
          </h2>

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

        <div className="mt-auto">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={onHome}
              className={cn(
                "h-12 rounded-2xl border border-white/10 bg-black/25",
                "text-[10px] font-black uppercase tracking-[0.22em] text-white/80",
                "hover:bg-white/5 active:scale-[0.99] transition",
              )}
            >
              Home Win
              <div className="mt-1 text-[10px] text-white/40">2-1</div>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={onDraw}
              className={cn(
                "h-12 rounded-2xl border border-white/10 bg-black/25",
                "text-[10px] font-black uppercase tracking-[0.22em] text-white/80",
                "hover:bg-white/5 active:scale-[0.99] transition",
              )}
            >
              Draw
              <div className="mt-1 text-[10px] text-white/40">1-1</div>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={onAway}
              className={cn(
                "h-12 rounded-2xl border border-white/10 bg-black/25",
                "text-[10px] font-black uppercase tracking-[0.22em] text-white/80",
                "hover:bg-white/5 active:scale-[0.99] transition",
              )}
            >
              Away Win
              <div className="mt-1 text-[10px] text-white/40">1-2</div>
            </button>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={onPredictScore}
            className={cn(
              "mt-4 w-full h-12 rounded-2xl",
              "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]",
              "text-xs font-black uppercase tracking-[0.22em]",
              "shadow-[0_0_24px_rgba(202,253,0,0.18)]",
              "hover:brightness-110 active:scale-[0.99] transition",
            )}
          >
            Predict Score
          </button>

          <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            <span>Swipe ← home</span>
            <span>Swipe → away</span>
          </div>
        </div>
      </div>
    </div>
  );
}
