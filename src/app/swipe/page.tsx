import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSwipeMatchesForUser } from "@/lib/swipe-data";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SwipePageClient } from "@/components/swipe/SwipePageClient";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

export default async function SwipePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/swipe");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/swipe");

  const matches = await getSwipeMatchesForUser(userId);

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  return (
    <DashboardLayout
      sideNavItems={getSideNavItems({ isAdmin })}
      activeKey="swipe"
      user={{
        name: session.user.username ?? session.user.name ?? "Kinetic Player",
        image: session.user.image ?? null,
        rankLabel: accountTierLabel(session.user.tier),
      }}
    >
      <SwipePageClient initialMatches={matches} />
    </DashboardLayout>
  );
}
