"use client";

import { useMemo, useState } from "react";

import { useNow } from "@/components/groups/matches/useNow";

import type { MatchListItem, MatchesView, PhaseType } from "@/components/groups/matches/types";
import { MatchesToolbar } from "@/components/groups/matches/MatchesToolbar";
import { MatchSection } from "@/components/groups/matches/MatchSection";
import { MatchesEmptyState } from "@/components/groups/matches/MatchesEmptyState";

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
    if (view === "completed") {
      return matches.filter((m) => m.status === "FINAL");
    }

    const inKickoffWindow = (m: MatchListItem) => {
      if (m.status === "FINAL") return false;
      const visibleAt = Date.parse(m.visibleAt);
      const lockAt = Date.parse(m.lockAt);
      return Number.isFinite(visibleAt) && Number.isFinite(lockAt) && visibleAt <= now && now < lockAt;
    };

    if (view === "kickoff") {
      return matches.filter(inKickoffWindow);
    }

    // upcoming: all future matches NOT in kickoff window
    return matches.filter((m) => {
      if (m.status === "FINAL") return false;
      const kickoff = Date.parse(m.kickoffAt);
      if (!Number.isFinite(kickoff) || kickoff <= now) return false;
      return !inKickoffWindow(m);
    });
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
            view === "upcoming"
              ? "Fixtures will appear when they enter the prediction window."
              : "Check back soon—more matches will populate here."
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
              groupId={groupId}
              phaseType={phaseType}
            />
          ))}
        </div>
      )}
    </div>
  );
}
