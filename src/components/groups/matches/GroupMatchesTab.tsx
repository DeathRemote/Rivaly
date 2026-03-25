"use client";

import { useMemo, useState } from "react";

import { useNow } from "@/components/groups/matches/useNow";

import type { MatchListItem, MatchesView, PhaseType } from "@/components/groups/matches/types";
import { MatchesToolbar } from "@/components/groups/matches/MatchesToolbar";
import { MatchSection } from "@/components/groups/matches/MatchSection";
import { MatchesEmptyState } from "@/components/groups/matches/MatchesEmptyState";

const PRESEASON_KICKOFF_SPAN_HOURS = 72; // "first weekend" bucket

export function GroupMatchesTab({
  groupId,
  phaseType,
  matches,
}: {
  groupId: string;
  phaseType: PhaseType;
  matches: MatchListItem[];
}) {
  const [view, setView] = useState<MatchesView>("kickoff");

  const now = useNow();

  const filtered = useMemo(() => {
    const completed = matches.filter((m) => m.status === "FINAL");
    const notCompleted = matches.filter((m) => m.status !== "FINAL");

    const inStandardKickoffWindow = (m: MatchListItem) => {
      const visibleAt = Date.parse(m.visibleAt);
      const lockAt = Date.parse(m.lockAt);
      return (
        Number.isFinite(visibleAt) &&
        Number.isFinite(lockAt) &&
        visibleAt <= now &&
        now < lockAt
      );
    };

    // Kickoff tab:
    // - normally: matches currently open for prediction (visibleAt <= now < lockAt)
    // - preseason special: if none are open, show the first weekend bucket so users can start early
    const standardKickoff = notCompleted.filter(inStandardKickoffWindow);

    const kickoffMatches = (() => {
      if (standardKickoff.length > 0) return standardKickoff;

      // Preseason fallback: take earliest future kickoff and include all matches in the next ~72h.
      const future = notCompleted
        .map((m) => ({ m, t: Date.parse(m.kickoffAt) }))
        .filter((x) => Number.isFinite(x.t) && x.t > now)
        .sort((a, b) => a.t - b.t);

      const first = future[0];
      if (!first) return [] as MatchListItem[];

      const spanMs = PRESEASON_KICKOFF_SPAN_HOURS * 60 * 60 * 1000;
      const end = first.t + spanMs;

      return future.filter((x) => x.t <= end).map((x) => x.m);
    })();

    if (view === "completed") return completed;

    if (view === "kickoff") {
      return kickoffMatches;
    }

    // Upcoming tab: ALL future matches NOT in kickoff.
    // These are imported and visible, but not yet open for prediction.
    const kickoffIds = new Set(kickoffMatches.map((m) => m.id));

    return notCompleted
      .map((m) => ({ m, t: Date.parse(m.kickoffAt) }))
      .filter((x) => Number.isFinite(x.t) && x.t > now && !kickoffIds.has(x.m.id))
      .sort((a, b) => a.t - b.t)
      .map((x) => x.m);
  }, [matches, view, now]);

  const sections = useMemo(() => {
    // Minimal grouping now: by phaseLabel (Gameweek/Group/Round). Later we can add
    // day grouping or matchday grouping.
    const map = new Map<string, MatchListItem[]>();
    for (const m of filtered) {
      const key = m.phaseLabel;
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered]);

  return (
    <div>
      <MatchesToolbar phaseType={phaseType} view={view} onViewChange={setView} />

      {filtered.length === 0 ? (
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
        </div>
      )}
    </div>
  );
}
