"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { LegalModal, type LegalModalMode } from "@/components/ui/LegalModal";

export function Footer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LegalModalMode>("privacy");

  function openModal(nextMode: LegalModalMode) {
    setMode(nextMode);
    setOpen(true);
  }

  return (
    <>
      <footer
        className={cn(
          "w-full",
          "border-t border-white/5",
          "bg-black/20",
          // Avoid being hidden behind mobile bottom nav.
          "pb-24 lg:pb-8",
          className,
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs font-bold text-white/35">
            <span>© Rivaly {new Date().getFullYear()}</span>
            <span className="text-white/20">•</span>

            <button
              type="button"
              onClick={() => openModal("privacy")}
              className={cn(
                "text-white/45 hover:text-lime-100 transition-colors",
                "underline decoration-white/20 underline-offset-4 hover:decoration-lime-200/40",
                "focus:outline-none focus:ring-2 focus:ring-lime-300/40 rounded",
              )}
            >
              Privacy Policy
            </button>

            <span className="text-white/20">·</span>

            <button
              type="button"
              onClick={() => openModal("terms")}
              className={cn(
                "text-white/45 hover:text-lime-100 transition-colors",
                "underline decoration-white/20 underline-offset-4 hover:decoration-lime-200/40",
                "focus:outline-none focus:ring-2 focus:ring-lime-300/40 rounded",
              )}
            >
              Terms &amp; Conditions
            </button>

            <span className="text-white/20">·</span>

            <Link
              href="/faq"
              className={cn(
                "text-white/45 hover:text-lime-100 transition-colors",
                "underline decoration-white/20 underline-offset-4 hover:decoration-lime-200/40",
                "focus:outline-none focus:ring-2 focus:ring-lime-300/40 rounded",
              )}
            >
              FAQ
            </Link>
          </div>
        </div>
      </footer>

      <LegalModal open={open} mode={mode} onClose={() => setOpen(false)} />
    </>
  );
}
