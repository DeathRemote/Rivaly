"use client";

import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { MatchPredictionCard } from "@/components/dashboard/MatchPredictionCard";
import { toDashboardMatchCard } from "@/app/dashboard/toDashboardMatchCard";

export type DashboardKickoffCard = {
  matchId: string;
  kickoffAt: string;
  home: string;
  away: string;
  groupId: string | null;
  lockAt: string;
};

export function DashboardMatchCarousel({
  matches,
  className,
}: {
  matches: DashboardKickoffCard[];
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const canScroll = matches.length > 3;

  const cardHref = useMemo(() => {
    // The dashboard "Predict Now" CTA should take the user into the Swipe flow.
    // Swipe already filters to matches the user hasn't predicted.
    return "/swipe";
  }, []);

  function scrollByCards(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;

    const firstCard = el.querySelector<HTMLElement>("[data-card]");
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 320;
    const gap = 24; // matches `gap-6`

    el.scrollBy({ left: dir * (cardWidth + gap), behavior: "smooth" });
  }

  return (
    <section className={cn("mt-8", className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-white/40">Only showing matches you haven’t predicted.</div>

        {canScroll ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              className={cn(
                "h-10 w-10 rounded-xl",
                "border border-white/10 bg-white/5 text-white/70",
                "hover:bg-white/10 transition",
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5 mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              className={cn(
                "h-10 w-10 rounded-xl",
                "border border-white/10 bg-white/5 text-white/70",
                "hover:bg-white/10 transition",
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5 mx-auto" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollerRef}
        className={
          "-mx-4 px-4 sm:mx-0 sm:px-0 " +
          "overflow-x-auto overscroll-x-contain " +
          "scroll-smooth snap-x snap-mandatory"
        }
      >
        <div className="flex gap-6 min-w-max pb-2">
          {matches.map((m) => (
            <div
              key={m.matchId}
              data-card
              className={cn("snap-start flex-none", "w-[280px] sm:w-[320px] lg:w-[340px]")}
            >
              <MatchPredictionCard match={toDashboardMatchCard(m)} href={cardHref} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
