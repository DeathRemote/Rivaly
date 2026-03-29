"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type { SwipeMatch } from "@/lib/swipe-data";
import { cn } from "@/lib/cn";

type Overlay = { label: string; tone: "lime" | "cyan" | "neutral"; corner: "left" | "right" | "center" };

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

  // PERF NOTE (mobile): pointermove can fire at a high rate. Avoid setState on every move.
  // We update transform via rAF + refs, and only set React state when the overlay *meaningfully* changes.
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  });
  const rafRef = useRef<number | null>(null);
  const lastOverlayRef = useRef<Overlay | null>(null);

  const [cardHeight, setCardHeight] = useState<number>(
    typeof window === "undefined" ? 700 : window.innerHeight,
  );
  const [dragActive, setDragActive] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (Number.isFinite(h) && h > 0) setCardHeight(h);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const kickoff = useMemo(() => new Date(match.kickoffAt), [match.kickoffAt]);
  const lockAt = useMemo(() => new Date(match.lockAt), [match.lockAt]);

  // Team name scaling (shared between home/away so they look consistent).
  // Avoid per-frame work: compute once on match change + on resize.
  const homeNameRef = useRef<HTMLDivElement | null>(null);
  const awayNameRef = useRef<HTMLDivElement | null>(null);
  const [nameScale, setNameScale] = useState(1);

  useEffect(() => {
    const homeEl = homeNameRef.current;
    const awayEl = awayNameRef.current;
    if (!homeEl || !awayEl) return;

    let cancelled = false;

    const compute = () => {
      // Always allow up to 3 lines.
      const maxLines = 3;

      // Try a small set of scales from 1 → 0.48 and pick the first that fits for BOTH.
      // (Some club names have long single words, e.g. "Wolverhampton", which must fit without mid-word breaks.)
      const scales = [
        1,
        0.97,
        0.94,
        0.91,
        0.88,
        0.85,
        0.82,
        0.79,
        0.76,
        0.73,
        0.7,
        0.67,
        0.64,
        0.61,
        0.58,
        0.55,
        0.52,
        0.5,
        0.48,
      ];

      const getMaxHeight = (el: HTMLElement) => {
        const cs = window.getComputedStyle(el);
        const lineHeightPx = Number.parseFloat(cs.lineHeight || "0");
        const lh = Number.isFinite(lineHeightPx) && lineHeightPx > 0 ? lineHeightPx : 1.05 * 16;
        return lh * maxLines + 0.5;
      };

      const measureNatural = (el: HTMLElement) => {
        const styleAny = el.style as unknown as {
          webkitLineClamp?: string;
          WebkitLineClamp?: string;
        };
        const prevClamp = styleAny.webkitLineClamp ?? styleAny.WebkitLineClamp ?? "";

        // Disable clamping for measurement.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el.style as any).webkitLineClamp = "unset";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el.style as any).WebkitLineClamp = "unset";

        const naturalHeight = el.scrollHeight;
        const naturalWidth = el.scrollWidth;
        const containerWidth = el.clientWidth;

        // Restore.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el.style as any).webkitLineClamp = prevClamp || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el.style as any).WebkitLineClamp = prevClamp || "";

        return { naturalHeight, naturalWidth, containerWidth };
      };

      // Text measurement helper: ensures the longest single word fits in the column.
      // This handles cases where scrollWidth lies (because of -webkit-box) and prevents mid-word clipping.
      const measureMaxWordWidth = (el: HTMLElement, text: string) => {
        const cs = window.getComputedStyle(el);
        const font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
        const letterSpacingPx = Number.parseFloat(cs.letterSpacing || "0");
        const letterSpacing = Number.isFinite(letterSpacingPx) ? letterSpacingPx : 0;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return 0;
        ctx.font = font;

        const words = text
          .split(/\s+/)
          .map((w) => w.trim())
          .filter(Boolean);

        let max = 0;
        for (const w of words) {
          const base = ctx.measureText(w).width;
          const spaced = base + Math.max(0, w.length - 1) * letterSpacing;
          if (spaced > max) max = spaced;
        }

        return max;
      };

      const homeText = homeEl.textContent ?? "";
      const awayText = awayEl.textContent ?? "";

      const homeLongestWord = measureMaxWordWidth(homeEl, homeText);
      const awayLongestWord = measureMaxWordWidth(awayEl, awayText);

      const homeColWidth = homeEl.clientWidth;
      const awayColWidth = awayEl.clientWidth;

      // Scale required so longest single word fits without clipping.
      const wordScale = Math.min(
        1,
        homeLongestWord > 0 ? homeColWidth / homeLongestWord : 1,
        awayLongestWord > 0 ? awayColWidth / awayLongestWord : 1,
      );

      let chosen = scales[scales.length - 1];

      // First: pick a scale that satisfies the 3-line max height for both.
      for (const s of scales) {
        const scaled = Math.min(s, wordScale);

        homeEl.style.setProperty("--name-scale", String(scaled));
        awayEl.style.setProperty("--name-scale", String(scaled));

        const home = measureNatural(homeEl);
        const away = measureNatural(awayEl);

        const heightOk = home.naturalHeight <= getMaxHeight(homeEl) && away.naturalHeight <= getMaxHeight(awayEl);

        if (heightOk) {
          chosen = scaled;
          break;
        }
      }

      homeEl.style.removeProperty("--name-scale");
      awayEl.style.removeProperty("--name-scale");

      if (!cancelled) setNameScale(chosen);
    };

    const raf = window.requestAnimationFrame(compute);

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(compute);
    });

    ro.observe(homeEl);
    ro.observe(awayEl);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [match.matchId]);

  function computeOverlay({ x, y }: { x: number; y: number }): Overlay | null {
    const ax = Math.abs(x);
    const ay = Math.abs(y);

    const thresholdX = 120;
    const thresholdY = cardHeight / 3;

    if (ay >= thresholdY && ay >= ax * 1.2) {
      return { label: "DRAW", tone: "neutral", corner: "center" };
    }

    if (ax >= thresholdX && ax >= ay) {
      return x < 0
        ? { label: "HOME WIN", tone: "lime", corner: "left" }
        : { label: "AWAY WIN", tone: "cyan", corner: "right" };
    }

    return null;
  }

  function applyTransform() {
    const el = ref.current;
    if (!el) return;

    rafRef.current = null;

    // If we’re playing the swipe-off animation, let React own the styles.
    if (animDirection) return;

    const { x, y, active } = dragRef.current;
    const rot = x / 22;

    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
    el.style.transition = active ? "none" : "transform 180ms ease";

    const nextOverlay = active ? computeOverlay({ x, y }) : null;
    const prevOverlay = lastOverlayRef.current;

    const same =
      prevOverlay?.label === nextOverlay?.label &&
      prevOverlay?.tone === nextOverlay?.tone &&
      prevOverlay?.corner === nextOverlay?.corner;

    if (!same) {
      lastOverlayRef.current = nextOverlay;
      setOverlay(nextOverlay);
    }
  }

  function scheduleFrame() {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(applyTransform);
  }

  // Reset transform when match changes or when an animation ends.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Let rAF compute handle non-animated transforms.
    if (!animDirection) {
      dragRef.current.x = 0;
      dragRef.current.y = 0;
      dragRef.current.active = false;
      lastOverlayRef.current = null;

      el.style.transform = "translate3d(0px, 0px, 0) rotate(0deg)";
      el.style.transition = "transform 180ms ease";
    }
  }, [match.matchId, animDirection]);

  const animatedStyle = useMemo(() => {
    if (!animDirection) return undefined;

    const x = animDirection === "left" ? -420 : animDirection === "right" ? 420 : 0;
    const y = animDirection === "down" ? 280 : animDirection === "up" ? -280 : -20;
    const r = animDirection === "left" ? -14 : animDirection === "right" ? 14 : 0;

    return {
      transform: `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`,
      transition: "transform 260ms ease, opacity 260ms ease",
      opacity: 0,
    } as const;
  }, [animDirection]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative z-50 h-full w-full rounded-[2rem] border border-white/10 bg-[#111417] overflow-hidden",
        "shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
        "touch-none", // prevent browser scroll/gesture from hijacking the drag
        "transform-gpu will-change-transform",
        disabled && "opacity-70",
      )}
      style={animatedStyle}
      onPointerDown={(e) => {
        if (disabled) return;

        // Don’t start a drag from interactive controls.
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("a")) return;

        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

        dragRef.current.active = true;
        setDragActive(true);
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.x = 0;
        dragRef.current.y = 0;

        onDragActiveChange?.(true);
        scheduleFrame();
      }}
      onPointerMove={(e) => {
        if (disabled) return;
        if (!dragRef.current.active) return;

        dragRef.current.x = e.clientX - dragRef.current.startX;
        dragRef.current.y = e.clientY - dragRef.current.startY;
        scheduleFrame();
      }}
      onPointerUp={() => {
        if (disabled) return;

        const thresholdX = 120;
        const thresholdY = cardHeight / 3;

        const x = dragRef.current.x;
        const y = dragRef.current.y;

        dragRef.current.active = false;
        setDragActive(false);
        dragRef.current.startX = 0;
        dragRef.current.startY = 0;
        dragRef.current.x = 0;
        dragRef.current.y = 0;

        onDragActiveChange?.(false);
        scheduleFrame();

        const ax = Math.abs(x);
        const ay = Math.abs(y);

        if (ax >= thresholdX && ax >= ay) {
          if (x <= -thresholdX) onSwipeLeft?.();
          else if (x >= thresholdX) onSwipeRight?.();
          return;
        }

        if (ay >= thresholdY && ay >= ax * 1.2) {
          if (y <= -thresholdY) onSwipeUp?.();
          else if (y >= thresholdY) onSwipeDown?.();
        }
      }}
      onPointerCancel={() => {
        dragRef.current.active = false;
        setDragActive(false);
        dragRef.current.startX = 0;
        dragRef.current.startY = 0;
        dragRef.current.x = 0;
        dragRef.current.y = 0;

        onDragActiveChange?.(false);
        scheduleFrame();
      }}
    >
      <div className="relative h-full p-6 sm:p-8 flex flex-col">
        {/* Reduce blur cost on mobile a bit; these are purely decorative */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-[80px] sm:blur-[120px]" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-[80px] sm:blur-[120px]" />

        {/* Swipe overlay */}
        {dragActive && overlay ? (
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
            Locks{" "}
            {lockAt.toLocaleString(undefined, {
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
                <div
                  ref={homeNameRef}
                  style={{ "--name-scale": nameScale } as React.CSSProperties}
                  className={cn(
                    // Strong typography, but responsive.
                    "font-display font-black italic tracking-tight text-white",
                    // Responsive font sizing without container queries (more compatible; no missing text on some browsers).
                    // Use a shared CSS var scale so home/away always match.
                    "text-[calc(clamp(1.65rem,6vw,3.15rem)*var(--name-scale,1))]",
                    // Clean multi-line wrapping: keep words intact, clamp lines, no overflow.
                    "whitespace-normal break-normal hyphens-none",
                    "[text-wrap:balance]",
                    "leading-[1.05]",
                    "overflow-hidden",
                    "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]",
                  )}
                >
                  {match.home.shortName ?? match.home.name}
                </div>
              </div>

              <div className="font-display text-xl md:text-2xl font-black italic text-white/25">VS</div>

              <div className="min-w-0 max-w-full text-center">
                <div
                  ref={awayNameRef}
                  style={{ "--name-scale": nameScale } as React.CSSProperties}
                  className={cn(
                    "font-display font-black italic tracking-tight text-white",
                    "text-[calc(clamp(1.65rem,6vw,3.15rem)*var(--name-scale,1))]",
                    "whitespace-normal break-normal hyphens-none",
                    "[text-wrap:balance]",
                    "leading-[1.05]",
                    "overflow-hidden",
                    "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]",
                  )}
                >
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
