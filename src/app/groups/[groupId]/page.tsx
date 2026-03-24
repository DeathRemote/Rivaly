import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AccessDenied } from "@/components/groups/AccessDenied";
import { GroupDetailsClient } from "@/components/groups/GroupDetailsClient";
import { GroupTabs, type GroupTabKey } from "@/components/groups/GroupTabs";
import { GroupLeaderboard } from "@/components/groups/GroupLeaderboard";
import { type LeaderboardRowData } from "@/components/groups/LeaderboardRow";
import { GroupMatchCard, type GroupMatch } from "@/components/groups/GroupMatchCard";
import { RecentResultCard } from "@/components/groups/RecentResultCard";
import { GroupMomentumCard } from "@/components/groups/GroupMomentumCard";
import { GroupMatchesTab } from "@/components/groups/matches/GroupMatchesTab";
import { GroupTableTab } from "@/components/groups/GroupTableTab";
import type { PhaseType } from "@/components/groups/matches/types";
import type { MatchListItem } from "@/components/groups/matches/types";
import { getMatchesForGroup } from "@/app/groups/[groupId]/matches/data";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

import { topNavItems, sideNavItems } from "@/features/dashboard/mock";

export default async function GroupDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups");
  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/groups");

  const { groupId } = await params;
  const tabParam = (await searchParams).tab;
  const tab = (
    tabParam === "matches" ? "matches" : tabParam === "table" ? "table" : "leaderboard"
  ) as GroupTabKey;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      sport: true,
      competition: true,
      competitionSeasonId: true,
      inviteCode: true,
      createdById: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
      members: {
        select: {
          userId: true,
          points: true,
          role: true,
          user: {
            select: {
              name: true,
              username: true,
              image: true,
            },
          },
        },
        orderBy: { points: "desc" },
      },
      _count: { select: { members: true } },
    },
  });

  if (!group) notFound();

  const membership = group.members.find((m) => m.userId === userId);
  if (!membership) {
    return (
      <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
        <AccessDenied message="You’re not a member of this group. Ask for an invite code or join from the Groups page." />
      </div>
    );
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: "Pro",
  };

  const leaderboard: LeaderboardRowData[] = group.members.map((m, idx) => {
    // Mock metrics for now; points are real.
    const accuracyPct = Math.max(42, Math.min(92, 55 + ((m.points % 37) as number)));
    const trend = idx % 5 === 0 ? "up" : idx % 7 === 0 ? "down" : "flat";

    return {
      rank: idx + 1,
      name: m.user.username ?? m.user.name ?? "Unknown",
      points: m.points,
      accuracyPct,
      trend,
      isYou: m.userId === userId,
    };
  });

  const upcomingMatches: GroupMatch[] = mockUpcomingMatches(group.sport);

  // Table tab: ensure standings exist (and are reasonably fresh) for the linked competition season.
  if (tab === "table" && group.competitionSeasonId) {
    const [rowsCount, seasonMeta, latestFinishedMatch] = await Promise.all([
      prisma.standingsRow.count({
        where: { competitionSeasonId: group.competitionSeasonId },
      }),
      prisma.competitionSeason.findUnique({
        where: { id: group.competitionSeasonId },
        select: { standingsUpdatedAt: true },
      }),
      prisma.match.findFirst({
        where: {
          competitionSeasonId: group.competitionSeasonId,
          status: "FINISHED",
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    const needsInitial = rowsCount === 0;
    const needsRefresh =
      Boolean(seasonMeta?.standingsUpdatedAt) &&
      Boolean(latestFinishedMatch?.updatedAt) &&
      latestFinishedMatch!.updatedAt > seasonMeta!.standingsUpdatedAt!;

    if (needsInitial || needsRefresh) {
      try {
        await syncCompetitionSeasonStandings({ competitionSeasonId: group.competitionSeasonId });
      } catch (err) {
        // Don't block the page; table may show stale/empty with a message.
        console.warn("[standings] sync failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  // Matches tab: merge saved group-scoped predictions into match list items so refreshes
  // always reflect the real DB state.
  const baseMatches = await getMatchesForGroup({
    groupId: group.id,
    phaseType: "LEAGUE" satisfies PhaseType,
  });
  const baseMatchKeys = baseMatches.map((m) => m.id);

  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      matchId: { in: baseMatchKeys },
    },
    select: { matchId: true, homeScore: true, awayScore: true, source: true, updatedAt: true },
  });

  const predictionByKey = new Map<string, (typeof predictions)[number]>(
    predictions.map((p) => [p.matchId, p] as const),
  );

  const matchesForTab: MatchListItem[] = baseMatches.map((m) => {
    const p = predictionByKey.get(m.id);
    if (!p) return m;

    return {
      ...m,
      userPrediction: {
        status: m.status === "FINAL" ? "COMPLETED" : "PREDICTED",
        summary: `${p.homeScore}-${p.awayScore}`,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        source: p.source,
        updatedAt: p.updatedAt.toISOString(),
      },
    };
  });

  return (
    <DashboardLayout
      topNavItems={topNavItems.map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))}
      sideNavItems={sideNavItems
        .map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))
        .filter((item) => (item.key === "admin" ? isAdmin : true))}
      activeKey="groups"
      user={user}
    >
      <GroupDetailsClient
        groupId={group.id}
        canDelete={group.createdById === userId || isAdmin}
        group={{
          name: group.name,
          competition: group.competition,
          sportLabel: sportLabel(group.sport),
          memberCount: group._count.members,
          description: null,
        }}
        inviteCode={group.inviteCode}
      />

      <GroupTabs groupId={group.id} active={tab} />

      {tab === "leaderboard" ? (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7">
            <GroupLeaderboard rows={leaderboard} />
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-display text-xl font-black uppercase tracking-tight text-white">
                Upcoming matches
              </h3>
              <span className="text-xs font-black uppercase tracking-[0.22em] text-lime-200/70">
                View All
              </span>
            </div>

            <div className="space-y-6">
              {upcomingMatches.map((m) => (
                <GroupMatchCard key={m.id} match={m} />
              ))}
            </div>

            <RecentResultCard />
            <GroupMomentumCard />
          </div>
        </div>
      ) : tab === "matches" ? (
        <GroupMatchesTab
          groupId={group.id}
          phaseType={"LEAGUE" satisfies PhaseType}
          matches={matchesForTab}
        />
      ) : (
        <GroupTableTab competitionSeasonId={group.competitionSeasonId ?? ""} />
      )}
    </DashboardLayout>
  );
}

function sportLabel(s: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS") {
  switch (s) {
    case "BASKETBALL":
      return "Basketball";
    case "TENNIS":
      return "Tennis";
    case "ESPORTS":
      return "Esports";
    case "SOCCER":
    default:
      return "Football";
  }
}

function mockUpcomingMatches(sport: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS"): GroupMatch[] {
  if (sport === "BASKETBALL") {
    return [
      { id: "lal-bos", timeLabel: "Tonight • 19:30", venueLabel: "STAPLES", left: { name: "LAKERS" }, right: { name: "CELTICS" } },
      { id: "gsw-phx", timeLabel: "Fri • 21:00", venueLabel: "CHASE", left: { name: "WARRIORS" }, right: { name: "SUNS" } },
    ];
  }

  return [
    { id: "ars-por", timeLabel: "Tonight • 20:45", venueLabel: "LONDON", left: { name: "Arsenal FC" }, right: { name: "FC Porto" } },
    { id: "rm-barca", timeLabel: "Sun • 21:00", venueLabel: "MADRID", left: { name: "REAL MADRID" }, right: { name: "BARCELONA" } },
  ];
}
