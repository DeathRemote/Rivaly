import Link from "next/link";
import {
  Shield,
  LayoutDashboard,
  ArrowUpDown,
  Users,
  ListOrdered,
  BadgeCheck,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { DashboardNavItem } from "@/features/dashboard/mock";
import { SidebarAd } from "@/components/ads/SidebarAd";
import { UserBadge } from "@/components/dashboard/UserBadge";

function iconForKey(key: DashboardNavItem["key"]) {
  switch (key) {
    case "dashboard":
      return LayoutDashboard;
    case "swipe":
      return ArrowUpDown;
    case "groups":
      return Users;
    case "tables":
      return ListOrdered;
    case "admin":
      return BadgeCheck;
    default:
      return Shield;
  }
}

export function DashboardSidebar({
  items,
  activeKey,
  user,
}: {
  items: DashboardNavItem[];
  activeKey: DashboardNavItem["key"];
  user: { name: string; image: string | null; rankLabel: string };
}) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 xl:w-72 lg:flex-col lg:bg-background lg:pt-20">
      <div className="px-5 xl:px-6 mb-6">
        {/* Profile shortcut */}
        <UserBadge name={user.name} rankLabel={user.rankLabel} image={user.image} />
      </div>

      <nav className="flex-1 space-y-1" aria-label="Sidebar">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = iconForKey(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-5 py-3 xl:gap-4 xl:px-6 xl:py-4",
                "font-display text-xs xl:text-sm font-bold uppercase tracking-[0.18em]",
                "transition-all duration-300",
                active
                  ? "bg-lime-300 text-black rounded-r-full shadow-[4px_0px_0px_0px_theme(colors.lime.100)]"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-lime-100 hover:translate-x-1 rounded-r-full",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  active ? "text-black" : "text-white/60 group-hover:text-lime-100",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {activeKey !== "swipe" ? (
        <div className="p-5 xl:p-6">
          <SidebarAd />
        </div>
      ) : null}
    </aside>
  );
}
