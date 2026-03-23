"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/cn";

export function UserMenu({
  user,
}: {
  user: {
    name: string;
    image: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/10",
          "hover:border-white/20 hover:bg-white/15 transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/40",
        )}
        aria-label="Open user menu"
        aria-expanded={open}
      >
        {user.image ? (
          <Image src={user.image} alt={user.name} fill className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-white/70">
            {(user.name || "U").slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-[0px_24px_48px_rgba(0,0,0,0.5)]">
          <div className="px-4 py-3">
            <div className="text-xs font-black text-lime-100">{user.name}</div>
          </div>
          <div className="h-px bg-white/10" />
          <div className="p-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
