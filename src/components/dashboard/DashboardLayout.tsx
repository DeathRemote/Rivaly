import type { DashboardNavItem } from "@/features/dashboard/mock";

import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";

export function DashboardLayout({
  sideNavItems,
  activeKey,
  user,
  children,
  hideMobileFab,
}: {
  sideNavItems: DashboardNavItem[];
  activeKey: DashboardNavItem["key"];
  user: { name: string; image: string | null; rankLabel: string };
  children: React.ReactNode;
  hideMobileFab?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden lg:overflow-x-visible">
      <DashboardTopNav user={user} />
      <DashboardSidebar activeKey={activeKey} items={sideNavItems} user={user} />

      <main className="lg:ml-64 xl:ml-72 pt-5 lg:pt-20 xl:pt-24 pb-28 lg:pb-32 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
