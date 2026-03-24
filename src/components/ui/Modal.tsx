"use client";

import { useEffect } from "react";

import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0c0e11]/95",
            "shadow-[0_24px_70px_rgba(0,0,0,0.6)]",
            className,
          )}
        >
          <div className="px-6 pt-6">
            <h2 className="font-display text-2xl font-black tracking-tight text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm text-white/60">{description}</p>
            ) : null}
          </div>

          <div className="px-6 pb-6 pt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
