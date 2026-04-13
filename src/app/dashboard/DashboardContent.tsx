import Link from "next/link";

import { getDashboardPayload } from "@/lib/dashboard-backend";

import { RankBadge } from "@/components/dashboard/RankBadge";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { GroupLeaderboardCard } from "@/components/dashboard/GroupLeaderboardCard";
import { DashboardMatchCarousel } from "@/components/dashboard/DashboardMatchCarousel";

export default async function DashboardContent({ userId }: { userId: string }) {
  const { standing, dash } = await getDashboardPayload(userId);

  return (
    <>
      {/* Hero / bento */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="relative overflow-hidden rounded-xl bg-white/5 p-8 md:col-span-2">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-lime-300/10 blur-[100px]" />

          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
            Global Standing
          </span>
          {standing.eligible ? (
            <>
              <h1 className="font-display text-5xl font-black italic tracking-tighter text-lime-100 md:text-7xl">
                Top {standing.topPercent}%
              </h1>
              <p className="mt-4 max-w-sm font-medium text-white/60">
                Based on recent form (30D), lifetime accuracy, and consistency (avg points per scored
                prediction).
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <RankBadge label={`TOP ${standing.topPercent}%`} icon="stars" tone="lime" />
                <RankBadge
                  label={`${standing.breakdown.scoredPredictions30d} SCORED (30D)`}
                  icon="flame"
                  tone="orange"
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl font-black italic tracking-tighter text-lime-100 md:text-6xl">
                Unranked
              </h1>
              <p className="mt-4 max-w-sm font-medium text-white/60">
                Get ranked after <span className="text-white">{standing.minRequired}</span> scored
                predictions. You currently have {standing.scoredPredictionsLifetime}.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <RankBadge label="GLOBAL STANDING" icon="stars" tone="lime" />
                <RankBadge
                  label={`${standing.scoredPredictionsLifetime}/${standing.minRequired} SCORED`}
                  icon="flame"
                  tone="orange"
                />
              </div>
            </>
          )}
        </section>

        <StatCard label="Last Result" accent="lime" className="bg-white/5">
          {dash.lastResult ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/10" />
                  <span className="font-display text-sm font-bold italic">{dash.lastResult.home}</span>
                </div>
                <span className="text-xs font-bold text-white/60">VS</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold italic">{dash.lastResult.away}</span>
                  <div className="h-8 w-8 rounded-full bg-white/10" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                    Your prediction
                  </div>
                  <div className="mt-2 font-display text-2xl font-black text-white">
                    {dash.lastResult.predicted}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                    Final
                  </div>
                  <div className="mt-2 font-display text-2xl font-black text-white">
                    {dash.lastResult.actual}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-white/60">Points earned</div>
                <div className="mt-1 font-display text-3xl font-black text-lime-300">
                  {dash.lastResult.points >= 0 ? "+" : ""}
                  {dash.lastResult.points} PTS
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/60">
              No scored results yet. Make predictions to start earning points.
            </div>
          )}
        </StatCard>
      </div>

      <SectionHeader
        title="What to predict this week"
        description="Matches open right now — fastest way to climb."
        accent="orange"
      />

      {dash.kickoff.matchesToPredict.length > 0 ? (
        <DashboardMatchCarousel matches={dash.kickoff.matchesToPredict} />
      ) : (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8">
          <div className="font-display text-2xl font-black italic text-lime-100">You’re all caught up</div>
          <p className="mt-2 max-w-xl text-sm font-medium text-white/60">
            All matches currently open for prediction have been predicted. Come back soon or check your
            groups for upcoming fixtures.
          </p>
          <div className="mt-6 flex gap-3 flex-wrap">
            <Link
              href="/groups"
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/80 hover:bg-white/10"
            >
              View upcoming matches
            </Link>
            {dash.spotlightGroup ? (
              <Link
                href={`/groups/${dash.spotlightGroup.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-lime-300/30 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-lime-100 hover:bg-lime-300/5"
              >
                Go to leaderboard
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-16">
        {dash.spotlightGroup ? (
          <GroupLeaderboardCard
            groupName={dash.spotlightGroup.name}
            spotlightMeta={{
              needsToPredictCount: dash.spotlightGroup.needsToPredictCount,
              groupId: dash.spotlightGroup.id,
            }}
            rows={(dash.spotlightGroup.leaderboardTop3 ?? []).map((r) => ({
              position: r.position,
              name: r.name,
              xp: r.points,
              isYou: r.isYou,
              accent: r.accent,
            }))}
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-white/60">
            Join a group to see a leaderboard spotlight here.
          </div>
        )}
      </div>
    </>
  );
}
