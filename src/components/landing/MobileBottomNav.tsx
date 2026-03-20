"use client";

import { Home, Layers, Search, Swords, Users } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

const items = [
  { label: "Home", href: "#top", icon: Home },
  { label: "Swipe", href: "#how", icon: Swords },
  { label: "Groups", href: "#how", icon: Users },
  { label: "Explore", href: "#features", icon: Search },
  { label: "Pricing", href: "#pricing", icon: Layers },
] as const;

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/70 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-4">
        {items.map((item, idx) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-white/60 transition-colors hover:text-white",
              idx === 0 && "text-lime-100",
            )}
          >
            <item.icon className={cn("size-5", idx === 0 && "text-lime-200")} aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
