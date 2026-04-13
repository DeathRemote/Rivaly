import { Suspense } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

import DashboardContent from "@/app/dashboard/DashboardContent";

function DashboardContentFallback() {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
      <div className="text-sm font-semibold">Loading dashboard…</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/dashboard");

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: accountTierLabel(session.user.tier),
  };

  return (
    <DashboardLayout sideNavItems={getSideNavItems({ isAdmin })} activeKey="dashboard" user={user}>
      <Suspense fallback={<DashboardContentFallback />}>
        <DashboardContent userId={userId} />
      </Suspense>
    </DashboardLayout>
  );
}
