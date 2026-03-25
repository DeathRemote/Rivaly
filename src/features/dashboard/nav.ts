import type { DashboardNavItem } from "@/features/dashboard/mock";

export function getTopNavItems(): DashboardNavItem[] {
  // Header cleanup: no Dashboard/Groups/Swipe links in the top header.
  return [];
}

export function getSideNavItems({ isAdmin }: { isAdmin: boolean }): DashboardNavItem[] {
  const items: DashboardNavItem[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "swipe", label: "Swipe", href: "/swipe" },
    { key: "groups", label: "Groups", href: "/groups" },
    { key: "tables", label: "Tables", href: "/tables" },
  ];

  if (isAdmin) items.push({ key: "admin", label: "Admin", href: "/admin" });

  return items;
}
