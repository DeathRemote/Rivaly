"use client";

import { useEffect, useRef, useState } from "react";

import { GroupLeaderboard } from "@/components/groups/GroupLeaderboard";
import type { LeaderboardRowData } from "@/components/groups/LeaderboardRow";

type Cursor = { cursorPoints: number; cursorUserId: string } | null;

export function GroupLeaderboardRemote({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<LeaderboardRowData[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstLoadRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  async function load(first: boolean, opts?: { limit?: number }) {
    try {
      first ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const url = new URL(`/api/internal/groups/${encodeURIComponent(groupId)}/leaderboard`, window.location.origin);
      url.searchParams.set("limit", String(opts?.limit ?? 10));
      if (!first && cursor) {
        url.searchParams.set("cursorPoints", String(cursor.cursorPoints));
        url.searchParams.set("cursorUserId", cursor.cursorUserId);
      }

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as {
        rows: LeaderboardRowData[];
        nextCursor: Cursor;
        totalCount?: number;
      };

      if (first && typeof data.totalCount === "number") {
        setTotalCount(data.totalCount);
        // If the group is small, just load everyone (<= 30) in one shot.
        if (data.totalCount > 0 && data.totalCount <= 30 && (opts?.limit ?? 10) < 30) {
          // Re-fetch once with a bigger page.
          setLoading(false);
          setLoadingMore(false);
          return void load(true, { limit: 30 });
        }
      }

      setRows((prev) => (first ? data.rows : [...prev, ...data.rows]));
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Reset when group changes
  useEffect(() => {
    firstLoadRef.current = false;
    setRows([]);
    setCursor(null);
    setTotalCount(null);
    setError(null);
    setLoading(true);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Infinite scroll: load next page when sentinel becomes visible.
  // IMPORTANT: hooks must not be conditional. Keep this before any early returns.
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
      { rootMargin: "400px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loadingMore]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        Loading leaderboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        Leaderboard unavailable. Please try again.
      </div>
    );
  }

  return (
    <div>
      <GroupLeaderboard rows={rows} />

      {cursor ? (
        <div className="mt-6 flex justify-center">
          <div ref={sentinelRef} className="h-10 w-full" />
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
            {loadingMore ? "Loading…" : "Scroll to load more"}
          </div>
        </div>
      ) : totalCount != null && totalCount <= 30 ? (
        <div className="mt-6 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
          Showing all {totalCount} members
        </div>
      ) : null}
    </div>
  );
}
