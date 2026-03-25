import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSwipeMatchesForUser } from "@/lib/swipe-data";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SwipePageClient } from "@/components/swipe/SwipePageClient";

import { sideNavItems, topNavItems } from "@/features/dashboard/mock";

export default async function SwipePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/swipe");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/swipe");

  const matches = await getSwipeMatchesForUser(userId);

  return (
    <DashboardLayout
      topNavItems={topNavItems}
      sideNavItems={sideNavItems}
      activeKey="swipe"
      user={{
        name: session.user.username ?? session.user.name ?? "Kinetic Player",
        image: session.user.image ?? null,
        rankLabel: session.user.tier ? String(session.user.tier) : "Free",
      }}
    >
      <SwipePageClient initialMatches={matches} />
    </DashboardLayout>
  );
}
