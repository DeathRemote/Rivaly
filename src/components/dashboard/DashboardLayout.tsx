import type { DashboardNavItem } from "@/features/dashboard/mock";

import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";

export function DashboardLayout({
  topNavItems,
  sideNavItems,
  activeKey,
  user,
  children,
  hideMobileFab,
}: {
  topNavItems: DashboardNavItem[];
  sideNavItems: DashboardNavItem[];
  activeKey: DashboardNavItem["key"];
  user: { name: string; image: string | null; rankLabel: string };
  children: React.ReactNode;
  hideMobileFab?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden lg:overflow-x-visible">
      <DashboardTopNav activeKey={activeKey} items={topNavItems} user={user} />
      <DashboardSidebar activeKey={activeKey} items={sideNavItems} user={user} />

      <main className="lg:ml-72 pt-6 lg:pt-24 pb-32 px-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <MobileBottomNav />

      {!hideMobileFab ? (
        <div className="lg:hidden fixed bottom-24 right-6 z-40">
          <button
            type="button"
            className="h-14 w-14 rounded-full bg-gradient-to-br from-lime-100 to-lime-400 text-black shadow-2xl shadow-lime-400/30 active:scale-90 transition"
            aria-label="Create prediction"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}
