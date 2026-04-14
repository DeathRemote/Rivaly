"use client";

import { useEffect, useRef, useState } from "react";

import { GroupLeaderboardRemote } from "@/components/groups/GroupLeaderboardRemote";
import { CompletedMatchesFeed } from "@/components/groups/CompletedMatchesFeed";
import { GroupMomentumCard } from "@/components/groups/GroupMomentumCard";

type Summary = {
  completedFeed: any[];
  momentum: any;
};

export function GroupLeaderboardPanel({ groupId }: { groupId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/internal/groups/${encodeURIComponent(groupId)}/leaderboard-summary`);
        if (!res.ok) throw new Error(await res.text());

        const data = (await res.json()) as Summary;
        setSummary(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard summary");
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-7">
        <GroupLeaderboardRemote groupId={groupId} />
      </div>

      <div className="col-span-12 lg:col-span-5 space-y-6">
        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white/60">Loading…</div>
        ) : error ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white/60">Summary unavailable.</div>
        ) : summary ? (
          <>
            <CompletedMatchesFeed items={summary.completedFeed as any} />
            {summary.momentum ? <GroupMomentumCard momentum={summary.momentum} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
