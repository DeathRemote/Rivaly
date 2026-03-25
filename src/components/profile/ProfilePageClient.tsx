"use client";

import { useMemo, useState } from "react";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileStatsGrid } from "@/components/profile/ProfileStatsGrid";
import { PredictionTrajectoryCard } from "@/components/profile/PredictionTrajectoryCard";
import { BadgesCard, type EarnedBadge } from "@/components/profile/BadgesCard";
import { RecentPerformanceList, type RecentPerformanceItem } from "@/components/profile/RecentPerformanceList";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

export function ProfilePageClient({
  profile,
  stats,
  confidence,
  trajectory,
  badges,
  recentPerformance,
}: {
  profile: {
    id: string;
    displayName: string;
    username: string | null;
    email: string | null;
    image: string | null;
    accountPlan: { key: string; label: string };
    createdAt: string;
  };
  stats: {
    totalPredictions: number;
    accuracyPct: number;
    totalCorrect: number;
    totalWrong: number;
  };
  confidence: {
    pct: number;
    label: string;
    description: string;
  };
  trajectory: {
    d7: Trajectory;
    d14: Trajectory;
    d30: Trajectory;
  };
  badges: {
    latest: EarnedBadge[];
    all: EarnedBadge[];
  };
  recentPerformance: RecentPerformanceItem[];
}) {
  const [editOpen, setEditOpen] = useState(false);

  const identity = useMemo(
    () => ({
      name: profile.displayName,
      username: profile.username,
      planLabel: profile.accountPlan.label,
      image: profile.image,
    }),
    [profile],
  );

  return (
    <div className="space-y-8">
      <ProfileHero
        identity={identity}
        confidence={confidence}
        onEditProfile={() => setEditOpen(true)}
      />

      <ProfileStatsGrid stats={stats} />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PredictionTrajectoryCard trajectory={trajectory} />
        </div>
        <div>
          <BadgesCard badges={badges} />
        </div>
      </section>

      <RecentPerformanceList items={recentPerformance} />

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{
          displayName: profile.displayName,
          username: profile.username ?? "",
          email: profile.email ?? "",
        }}
      />
    </div>
  );
}

type Trajectory = {
  days: number;
  points: number;
  accuracyPct: number;
  series: Array<{ day: string; points: number; correct: number; total: number }>;
};
