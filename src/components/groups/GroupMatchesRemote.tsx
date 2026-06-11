"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MatchListItem, MatchesView, PhaseType } from "@/components/groups/matches/types";
import { MatchesToolbar } from "@/components/groups/matches/MatchesToolbar";
import { MatchSection } from "@/components/groups/matches/MatchSection";
import { MatchesEmptyState } from "@/components/groups/matches/MatchesEmptyState";

type Cursor = { cursorKickoffAt: string; cursorId: string } | null;

export function GroupMatchesRemote({ groupId, phaseType, initialView }: { groupId: string; phaseType: PhaseType; initialView?: MatchesView }) {
  const [view, setView] = useState<MatchesView>(initialView ?? "kickoff");

  const [items, setItems] = useState<MatchListItem[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstLoadRef = useRef<string>("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const bucket = view;

  async function load(first: boolean) {
    try {
      first ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const url = new URL(`/api/internal/groups/${encodeURIComponent(groupId)}/matches`, window.location.origin);
      url.searchParams.set("bucket", bucket);
      // Kickoff view should show the full slate for big tournaments (e.g. World Cup group stage).
      url.searchParams.set("limit", bucket === "kickoff" ? "100" : "10");
      if (!first && cursor) {
        url.searchParams.set("cursorKickoffAt", cursor.cursorKickoffAt);
        url.searchParams.set("cursorId", cursor.cursorId);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as { matches: MatchListItem[]; nextCursor: Cursor };

      setItems((prev) => (first ? data.matches : [...prev, ...data.matches]));
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const key = `${groupId}:${bucket}`;
    if (firstLoadRef.current === key) return;
    firstLoadRef.current = key;

    setItems([]);
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, bucket]);

  const sections = useMemo(() => {
    const map = new Map<string, MatchListItem[]>();
    for (const m of items) {
      const key = m.phaseLabel;
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()].map(([label, it]) => ({ label, items: it }));
  }, [items]);

  // Infinite scroll: when cursor exists, load next page as the sentinel comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!cursor) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (loadingMore) return;
        if (!cursor) return;
        void load(false);
      },
      { rootMargin: "500px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadingMore]);

  return (
    <div>
      <MatchesToolbar phaseType={phaseType} view={view} onViewChange={setView} />

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">Loading matches…</div>
      ) : error ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">Matches unavailable. Please try again.</div>
      ) : items.length === 0 ? (
        <MatchesEmptyState
          title={
            view === "completed"
              ? "No completed matches yet"
              : view === "upcoming"
                ? "No upcoming matches"
                : "No kickoff matches right now"
          }
          subtitle={
            view === "kickoff"
              ? "These matches are open for prediction right now."
              : view === "upcoming"
                ? "Future fixtures imported into Rivaly (prediction opens closer to kickoff)."
                : "Check back soon—results will appear here once matches finish."
          }
        />
      ) : (
        <div className="space-y-10">
          {sections.map((s) => (
            <MatchSection
              key={s.label}
              title={s.label}
              subtitle={phaseType === "LEAGUE" ? "Your weekly slate." : undefined}
              matches={s.items}
            />
          ))}

          {cursor ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div ref={sentinelRef} className="h-10 w-full" />
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
                {loadingMore ? "Loading…" : "Scroll to load more"}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
