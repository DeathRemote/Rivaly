import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";

import { getGroupDetails } from "@/lib/group-details-backend";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AccessDenied } from "@/components/groups/AccessDenied";
import { GroupDetailsClient } from "@/components/groups/GroupDetailsClient";
import { GroupTabs, type GroupTabKey } from "@/components/groups/GroupTabs";
import { GroupLeaderboardPanel } from "@/components/groups/GroupLeaderboardPanel";
import { GroupMatchesRemote } from "@/components/groups/GroupMatchesRemote";
import { GroupPredictedTablesTab } from "@/components/groups/GroupPredictedTablesTab";
import { GroupTableTab } from "@/components/groups/GroupTableTab";
import { ClientOnly } from "@/components/ui/ClientOnly";
import type { PhaseType } from "@/components/groups/matches/types";

import { prisma } from "@/lib/prisma";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

export default async function GroupDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string; bucket?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups");
  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/groups");

  const { groupId } = await params;
  const sp = await searchParams;
  const tabParam = sp.tab;
  const tab = (
    tabParam === "matches"
      ? "matches"
      : tabParam === "table"
        ? "table"
        : tabParam === "predicted-table"
          ? "predicted-table"
          : "leaderboard"
  ) as GroupTabKey;

  const bucketParam = sp.bucket;
  const initialMatchesView =
    bucketParam === "upcoming" || bucketParam === "completed" || bucketParam === "kickoff"
      ? (bucketParam as "kickoff" | "upcoming" | "completed")
      : "kickoff";

  let details;
  try {
    details = await getGroupDetails(userId, groupId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[group-details] load failed", { groupId, userId, msg });

    if (msg.includes("404") || msg.toLowerCase().includes("not found")) notFound();

    if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
      return (
        <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
          <AccessDenied message="You’re not a member of this group. Ask for an invite code or join from the Groups page." />
        </div>
      );
    }

    // Don't crash the whole route with the generic Next error UI.
    // Show a soft error while keeping the dashboard shell.
    const ownerEmail = process.env.OWNER_EMAIL;
    const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
    const isAdmin = isOwner || session.user.role === "ADMIN";

    const user = {
      name: session.user.username ?? session.user.name ?? "Kinetic Player",
      image: session.user.image ?? null,
      rankLabel: accountTierLabel(session.user.tier),
    };

    return (
      <DashboardLayout sideNavItems={getSideNavItems({ isAdmin })} activeKey="groups" user={user}>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
          This page couldn’t load right now. Please try again.
        </div>
      </DashboardLayout>
    );
  }

  const group = details.group;

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: accountTierLabel(session.user.tier),
  };

  const membershipRow = details.membership;

  const currentUserAccuracy = details.viewer.accuracyPct;

  const competitionSeasonId = group.competitionSeasonId ?? "";

  const hasCompetitionGroups = Boolean(
    competitionSeasonId &&
      (await prisma.competitionGroup.findFirst({
        where: { competitionPhase: { competitionSeasonId } },
        select: { id: true },
      })),
  );

  // Show this tab for competitions with a group-stage structure.
  // (In practice, this is the World Cup-style group+knockout format; knockouts may not be imported yet.)
  const showPredictedTable = hasCompetitionGroups;

  return (
    <DashboardLayout
      sideNavItems={getSideNavItems({ isAdmin })}
      activeKey="groups"
      user={user}
    >
      <GroupDetailsClient
        groupId={group.id}
        canDelete={details.canDelete || isAdmin}
        group={{
          name: group.name,
          competition: group.competition,
          sportLabel: sportLabel(group.sport),
          memberCount: group.memberCount,
          description: null,
          userStats: {
            points: membershipRow?.points ?? 0,
            accuracyPct: currentUserAccuracy,
          },
        }}
        inviteCode={details.inviteCode}
      />

      <GroupTabs groupId={group.id} active={tab} showPredictedTable={showPredictedTable} />

      {tab === "leaderboard" ? (
        <ClientOnly
          fallback={
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
              Loading leaderboard…
            </div>
          }
        >
          <GroupLeaderboardPanel groupId={group.id} />
        </ClientOnly>
      ) : tab === "predicted-table" ? (
        <GroupPredictedTablesTab competitionSeasonId={competitionSeasonId} viewerUserId={userId} />
      ) : tab === "matches" ? (
        <ClientOnly
          fallback={
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
              Loading matches…
            </div>
          }
        >
          <GroupMatchesRemote
            groupId={group.id}
            phaseType={(showPredictedTable ? "GROUP_STAGE" : "LEAGUE") satisfies PhaseType}
            initialView={initialMatchesView}
          />
        </ClientOnly>
      ) : (
        <GroupTableTab competitionSeasonId={competitionSeasonId} />
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

