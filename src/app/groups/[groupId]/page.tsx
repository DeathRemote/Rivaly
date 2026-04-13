import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";

import { getGroupDetails } from "@/lib/group-details-backend";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AccessDenied } from "@/components/groups/AccessDenied";
import { GroupDetailsClient } from "@/components/groups/GroupDetailsClient";
import { GroupTabs, type GroupTabKey } from "@/components/groups/GroupTabs";
import { GroupLeaderboardRemote } from "@/components/groups/GroupLeaderboardRemote";
import { GroupMatchesRemote } from "@/components/groups/GroupMatchesRemote";
import { GroupTableTab } from "@/components/groups/GroupTableTab";
import type { PhaseType } from "@/components/groups/matches/types";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

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

  let details;
  try {
    details = await getGroupDetails(userId, groupId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) notFound();
    if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
      return (
        <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
          <AccessDenied message="You’re not a member of this group. Ask for an invite code or join from the Groups page." />
        </div>
      );
    }
    throw err;
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

  const currentUserAccuracy = 0;

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

      <GroupTabs groupId={group.id} active={tab} />

      {tab === "leaderboard" ? (
        <GroupLeaderboardRemote groupId={group.id} />
      ) : tab === "matches" ? (
        <GroupMatchesRemote groupId={group.id} phaseType={"LEAGUE" satisfies PhaseType} initialView={"kickoff"} />
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

