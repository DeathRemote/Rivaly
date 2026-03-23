import { auth } from "@/auth";
import { redirect } from "next/navigation";

import {
  mockLastResult,
  mockLeaderboard,
  mockMatches,
  mockStanding,
  sideNavItems,
  topNavItems,
} from "@/features/dashboard/mock";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RankBadge } from "@/components/dashboard/RankBadge";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { MatchPredictionCard } from "@/components/dashboard/MatchPredictionCard";
import { GroupLeaderboardCard } from "@/components/dashboard/GroupLeaderboardCard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const user = {
    name: session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: "Pro",
  };

  return (
    <DashboardLayout
      topNavItems={topNavItems}
      sideNavItems={sideNavItems}
      activeKey="dashboard"
      user={user}
    >
      {/* Hero / bento */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="relative overflow-hidden rounded-xl bg-white/5 p-8 md:col-span-2">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-lime-300/10 blur-[100px]" />

          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
            Global Standing
          </span>
          <h1 className="font-display text-5xl font-black italic tracking-tighter text-lime-100 md:text-7xl">
            #{mockStanding.rankNumber}nd
          </h1>
          <p className="mt-4 max-w-xs font-medium text-white/60">
            You&apos;re in the top {mockStanding.percentile}% of the Kinetic League this week.
            Keep the streak alive.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RankBadge label={mockStanding.tierLabel.toUpperCase()} icon="stars" tone="lime" />
            <RankBadge
              label={`${mockStanding.winStreak} WIN STREAK`}
              icon="flame"
              tone="orange"
            />
          </div>
        </section>

        <StatCard label="Last Result" accent="lime" className="bg-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/10" />
              <span className="font-display text-sm font-bold italic">{mockLastResult.leftTeam}</span>
            </div>
            <span className="text-xs font-bold text-white/60">VS</span>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold italic">{mockLastResult.rightTeam}</span>
              <div className="h-8 w-8 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="font-display text-3xl font-black">
              {mockLastResult.resultLabel}
            </div>
            <div className="mt-1 text-sm font-bold text-lime-300">
              +{mockLastResult.deltaPoints.toLocaleString()} PTS
            </div>
          </div>

          <button className="mt-6 w-full rounded-lg bg-white/10 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white/60 hover:text-lime-100">
            View Replay
          </button>
        </StatCard>
      </div>

      <SectionHeader
        title="What to predict this week"
        description="High-stakes matches curated for your rank."
        accent="orange"
        right={
          <>
            <button
              type="button"
              className="rounded-full bg-white/5 p-2 hover:bg-white/10"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              className="rounded-full bg-white/5 p-2 hover:bg-white/10"
              aria-label="Next"
            >
              ›
            </button>
          </>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {mockMatches.map((match) => (
          <MatchPredictionCard key={match.id} match={match} />
        ))}
      </div>

      <div className="mt-16">
        <GroupLeaderboardCard groupName="Elite Strikers Group" rows={mockLeaderboard} />
      </div>
    </DashboardLayout>
  );
}
