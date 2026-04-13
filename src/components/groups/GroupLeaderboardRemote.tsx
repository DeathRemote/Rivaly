"use client";

import { useEffect, useRef, useState } from "react";

import { GroupLeaderboard } from "@/components/groups/GroupLeaderboard";
import type { LeaderboardRowData } from "@/components/groups/LeaderboardRow";

type Cursor = { cursorPoints: number; cursorUserId: string } | null;

export function GroupLeaderboardRemote({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<LeaderboardRowData[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstLoadRef = useRef(false);

  async function load(first: boolean) {
    try {
      first ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const url = new URL(`/api/internal/groups/${encodeURIComponent(groupId)}/leaderboard`, window.location.origin);
      url.searchParams.set("limit", "10");
      if (!first && cursor) {
        url.searchParams.set("cursorPoints", String(cursor.cursorPoints));
        url.searchParams.set("cursorUserId", cursor.cursorUserId);
      }

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as {
        rows: LeaderboardRowData[];
        nextCursor: Cursor;
      };

      setRows((prev) => (first ? data.rows : [...prev, ...data.rows]));
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(false)}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
