import Link from "next/link";
import { Compass, House, User, Users, Swipe } from "lucide-react";

import { cn } from "@/lib/cn";

type Item = {
  label: string;
  href: string;
  key: "home" | "swipe" | "groups" | "explore" | "profile";
  icon: React.ComponentType<{ className?: string }>;
};

const items: Item[] = [
  { key: "home", label: "Home", href: "/dashboard", icon: House },
  { key: "swipe", label: "Swipe", href: "/swipe", icon: Swipe },
  { key: "groups", label: "Groups", href: "/groups", icon: Users },
  { key: "explore", label: "Explore", href: "/explore", icon: Compass },
  { key: "profile", label: "Profile", href: "/profile", icon: User },
];

export function MobileBottomNav({ activeKey = "home" }: { activeKey?: Item["key"] }) {
  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 z-50 w-full",
        "rounded-t-[1.5rem] bg-black/50 backdrop-blur-xl",
        "shadow-[0px_-8px_24px_rgba(0,0,0,0.5)]",
        "px-4 pb-6 pt-3",
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center",
                "tap-highlight-transparent",
                active ? "text-lime-100 scale-110" : "text-white/60 opacity-60",
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-lime-100" : "text-white/60")} />
              <span className="font-display text-[10px] font-bold uppercase tracking-tight mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
