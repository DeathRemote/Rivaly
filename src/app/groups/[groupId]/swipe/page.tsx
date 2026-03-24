import Link from "next/link";

import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { topNavItems, sideNavItems } from "@/features/dashboard/mock";

export default async function GroupSwipePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups");

  const { groupId } = await params;

  return (
    <DashboardLayout
      topNavItems={topNavItems.map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))}
      sideNavItems={sideNavItems.map((i) => (i.key === "groups" ? { ...i, href: "/groups" } : i))}
      activeKey="groups"
      user={{
        name: session.user.username ?? session.user.name ?? "Kinetic Player",
        image: session.user.image ?? null,
        rankLabel: "Pro",
      }}
    >
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
          Coming soon
        </div>
        <h1 className="mt-3 font-display text-4xl font-black italic tracking-tight text-white">
          Swipe Predictions
        </h1>
        <p className="mt-3 text-sm font-medium text-white/60 max-w-2xl">
          This is the next feature we’re building. For now, use the Matches tab.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/groups/${groupId}?tab=matches`}
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-xs font-black uppercase tracking-[0.22em] text-black"
          >
            Go to Matches
          </Link>
          <Link
            href={`/groups/${groupId}`}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-6 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Back to Group
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
