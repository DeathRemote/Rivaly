import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";

import { cn } from "@/lib/cn";
import type { DashboardNavItem } from "@/features/dashboard/mock";

export function DashboardTopNav({
  activeKey,
  items,
  user,
}: {
  activeKey: DashboardNavItem["key"];
  items: DashboardNavItem[];
  user: { name: string; image: string | null };
}) {
  return (
    <header className="fixed top-0 z-50 w-full bg-white/5 shadow-[0px_24px_48px_rgba(0,0,0,0.4)]">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-display text-2xl font-black italic tracking-tighter text-lime-100"
          >
            Rivaly
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Dashboard top navigation">
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "font-display font-bold tracking-tight transition-colors duration-200",
                    active
                      ? "text-lime-100 border-b-2 border-lime-100 py-1"
                      : "text-white/60 hover:text-lime-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-white/60 hover:text-lime-100 active:scale-95 transition"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/10">
            {user.image ? (
              <Image src={user.image} alt={user.name} fill className="object-cover" />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
