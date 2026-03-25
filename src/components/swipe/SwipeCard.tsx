"use client";

import { useMemo, useRef, useState } from "react";

import type { SwipeMatch } from "@/lib/swipe-data";
import { cn } from "@/lib/cn";

export function SwipeCard({
  match,
  disabled,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPredictScore,
  onSkip,
  onDragActiveChange,
  animDirection,
}: {
  match: SwipeMatch;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPredictScore?: () => void;
  onSkip?: () => void;
  onDragActiveChange?: (active: boolean) => void;
  animDirection?: "left" | "right" | "down" | "up" | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    active: boolean;
    startX: number;
    startY: number;
  }>({
    x: 0,
    y: 0,
    active: false,
    startX: 0,
    startY: 0,
  });

  const kickoff = useMemo(() => new Date(match.kickoffAt), [match.kickoffAt]);
  const lockAt = useMemo(() => new Date(match.lockAt), [match.lockAt]);

  const overlay = useMemo(() => {
    if (!drag.active) return null;

    const ax = Math.abs(drag.x);
    const ay = Math.abs(drag.y);
    const min = 24;
    if (Math.max(ax, ay) < min) return null;

    // Dominant axis overlay
    if (ay > ax) {
      return { label: "DRAW", tone: "neutral" as const, corner: "center" as const };
    }

    return drag.x < 0
      ? { label: "HOME WIN", tone: "lime" as const, corner: "left" as const }
      : { label: "AWAY WIN", tone: "cyan" as const, corner: "right" as const };
  }, [drag.active, drag.x, drag.y]);

  const style = useMemo(() => {
    if (animDirection) {
      const x = animDirection === "left" ? -420 : animDirection === "right" ? 420 : 0;
      const y = animDirection === "down" ? 280 : animDirection === "up" ? -280 : -20;
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
        "h-full w-full rounded-[2rem] border border-white/10 bg-[#111417] overflow-hidden",
        "shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
        "touch-none", // critical for mobile: prevent browser scroll/gesture from hijacking the drag
        disabled && "opacity-70",
      )}
      style={style}
      onPointerDown={(e) => {
        if (disabled) return;

        // Don’t start a drag from interactive controls.
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("a")) return;

        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        onDragActiveChange?.(true);
        setDrag({ x: 0, y: 0, active: true, startX: e.clientX, startY: e.clientY });
      }}
      onPointerMove={(e) => {
        if (disabled) return;
        if (!drag.active) return;
        setDrag((d) => ({
          ...d,
          x: e.clientX - d.startX,
          y: e.clientY - d.startY,
        }));
      }}
      onPointerUp={() => {
        if (disabled) return;
        const threshold = 120;
        const x = drag.x;
        const y = drag.y;

        onDragActiveChange?.(false);
        setDrag({ x: 0, y: 0, active: false, startX: 0, startY: 0 });

        const ax = Math.abs(x);
        const ay = Math.abs(y);

        // Prefer the dominant axis (more "Tinder" feel)
        if (ax >= threshold && ax >= ay) {
          if (x <= -threshold) onSwipeLeft?.();
          else if (x >= threshold) onSwipeRight?.();
          return;
        }

        if (ay >= threshold && ay > ax) {
          if (y <= -threshold) onSwipeUp?.();
          else if (y >= threshold) onSwipeDown?.();
        }
      }}
      onPointerCancel={() => {
        onDragActiveChange?.(false);
        setDrag({ x: 0, y: 0, active: false, startX: 0, startY: 0 });
      }}
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
              overlay.corner === "left"
                ? "left-6"
                : overlay.corner === "right"
                  ? "right-6"
                  : "left-1/2 -translate-x-1/2",
              overlay.tone === "lime"
                ? "bg-lime-300 text-black"
                : overlay.tone === "cyan"
                  ? "bg-cyan-300 text-black"
                  : "bg-white text-black",
            )}
          >
            {overlay.label}
          </div>
        ) : null}

        <div className="pt-12 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            {match.competitionLabel}
          </div>

          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Locks {lockAt.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        <div className="mt-6 text-center">

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
