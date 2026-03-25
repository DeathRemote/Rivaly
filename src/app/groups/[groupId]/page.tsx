import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AccessDenied } from "@/components/groups/AccessDenied";
import { GroupDetailsClient } from "@/components/groups/GroupDetailsClient";
import { GroupTabs, type GroupTabKey } from "@/components/groups/GroupTabs";
import { GroupLeaderboard } from "@/components/groups/GroupLeaderboard";
import { type LeaderboardRowData } from "@/components/groups/LeaderboardRow";
import { CompletedMatchesFeed } from "@/components/groups/CompletedMatchesFeed";
import { GroupMomentumCard } from "@/components/groups/GroupMomentumCard";
import { GroupMatchesTab } from "@/components/groups/matches/GroupMatchesTab";
import { GroupTableTab } from "@/components/groups/GroupTableTab";
import type { PhaseType } from "@/components/groups/matches/types";
import type { MatchListItem } from "@/components/groups/matches/types";
import { getMatchesForGroup } from "@/app/groups/[groupId]/matches/data";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

import { getSideNavItems, getTopNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";
import {
  getGroupCompletedMatchFeed,
  getGroupMemberAccuracies,
  getGroupMomentum,
} from "@/lib/group-stats";

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
    rankLabel: accountTierLabel(session.user.tier),
  };

  const membershipRow = group.members.find((m) => m.userId === userId);

  const accuracyByUser = await getGroupMemberAccuracies(group.id);

  const [completedFeed, momentum] =
    tab === "leaderboard"
      ? await Promise.all([
          getGroupCompletedMatchFeed({ groupId: group.id, limitMatches: 6 }),
          getGroupMomentum(group.id),
        ])
      : [[], null];

  const leaderboard: LeaderboardRowData[] = group.members.map((m, idx) => {
    const acc = accuracyByUser.get(m.userId);
    const accuracyPct = acc && acc.scored > 0 ? Math.round((acc.correct / acc.scored) * 100) : 0;

    // Trend v0: compare event count last 7D vs previous 7D.
    const trend =
      acc && acc.last7d !== acc.prev7d
        ? acc.last7d > acc.prev7d
          ? "up"
          : "down"
        : "flat";

    return {
      rank: idx + 1,
      name: m.user.username ?? m.user.name ?? "Unknown",
      points: m.points,
      accuracyPct,
      trend,
      isYou: m.userId === userId,
    };
  });

  const currentUserAccuracy = (() => {
    const acc = accuracyByUser.get(userId);
    if (!acc || acc.scored === 0) return 0;
    return Math.round((acc.correct / acc.scored) * 100);
  })();

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
  const matchesForTab: MatchListItem[] =
    tab === "matches"
      ? await (async () => {
          const baseMatches = await getMatchesForGroup({
            groupId: group.id,
            phaseType: "LEAGUE" satisfies PhaseType,
          });
          const baseMatchKeys = baseMatches.map((m) => m.id);

          const predictions =
            baseMatchKeys.length === 0
              ? []
              : await prisma.prediction.findMany({
                  where: { userId, matchId: { in: baseMatchKeys } },
                  select: { matchId: true, homeScore: true, awayScore: true, source: true, updatedAt: true },
                });

          const predictionByKey = new Map<string, (typeof predictions)[number]>(
            predictions.map((p) => [p.matchId, p] as const),
          );

          return baseMatches.map((m) => {
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
        })()
      : [];

  return (
    <DashboardLayout
      topNavItems={getTopNavItems()}
      sideNavItems={getSideNavItems({ isAdmin })}
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
          userStats: {
            points: membershipRow?.points ?? 0,
            accuracyPct: currentUserAccuracy,
          },
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
            <CompletedMatchesFeed items={completedFeed} />
            {momentum ? <GroupMomentumCard momentum={momentum} /> : null}
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

