import Link from "next/link";
import { Bell } from "lucide-react";

import { UserMenu } from "@/components/dashboard/UserMenu";

export function DashboardTopNav({
  user,
}: {
  user: { name: string; image: string | null };
}) {
  return (
    <header className="hidden lg:block fixed top-0 z-50 w-full bg-white/5 shadow-[0px_24px_48px_rgba(0,0,0,0.4)]">
      <div className="flex h-16 w-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-display text-2xl font-black italic tracking-tighter text-lime-100"
          >
            Rivaly
          </Link>

          {/* Header nav links removed (navigation lives in sidebar + bottom nav). */}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-white/60 hover:text-lime-100 active:scale-95 transition"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
