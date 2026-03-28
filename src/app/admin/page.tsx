import { requireAdminPageAccess } from "@/lib/admin/auth";

import { getSideNavItems } from "@/features/dashboard/nav";
import { accountTierLabel } from "@/lib/accountTier";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminPageClient } from "@/components/admin/AdminPageClient";

import { getAdminStatsCached } from "@/lib/admin/stats";
import { getSportConfigsCached } from "@/lib/admin/sports";
import { getAdminCatalogCached } from "@/lib/admin/catalog";

export default async function AdminPage() {
  const session = await requireAdminPageAccess({ callbackUrl: "/admin" });

  const user = {
    name: session.user.username ?? session.user.name ?? "Kinetic Player",
    image: session.user.image ?? null,
    rankLabel: accountTierLabel(session.user.tier),
  };

  const [stats, sports, catalog] = await Promise.all([
    getAdminStatsCached(),
    getSportConfigsCached(),
    getAdminCatalogCached(),
  ]);

  return (
    <DashboardLayout
      sideNavItems={getSideNavItems({ isAdmin: true })}
      activeKey="admin"
      user={user}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <AdminPageClient initialStats={stats} initialSports={sports} initialCatalog={catalog} />
      </div>
    </DashboardLayout>
  );
}
