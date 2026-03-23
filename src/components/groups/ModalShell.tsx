"use client";

import { useEffect } from "react";

import { cn } from "@/lib/cn";

export function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  variant = "default",
  showClose = true,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "centered";
  showClose?: boolean;
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={cn(
          "relative w-full overflow-hidden",
          variant === "default" ? "max-w-2xl rounded-2xl" : "max-w-lg rounded-[2rem]",
          "border border-white/10 bg-[#12151a]/90 backdrop-blur-xl",
          "shadow-[0_48px_96px_rgba(0,0,0,0.6)]",
        )}
      >
        {variant === "default" ? (
          <div className="flex items-start justify-between gap-6 border-b border-white/10 bg-white/5 p-6 sm:p-8">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-lime-200/80">
                Initiate Group
              </div>
              <h2 className="mt-1 font-display text-3xl font-black tracking-tight text-white">
                {title}
              </h2>
              {subtitle ? <p className="mt-2 text-sm text-white/60">{subtitle}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full border border-white/10 bg-black/20 text-white/60 hover:text-white hover:bg-white/5"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : (
          <>
            {showClose ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 z-10 h-10 w-10 rounded-full border border-white/10 bg-black/20 text-white/60 hover:text-white hover:bg-white/5"
                aria-label="Close"
              >
                ×
              </button>
            ) : null}
            <div className="sr-only">
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </>
        )}

        <div className={cn(variant === "default" ? "p-6 sm:p-8" : "p-8 sm:p-10")}>{children}</div>

        {footer ? (
          <div className={cn(variant === "default" ? "px-6 pb-6 sm:px-8 sm:pb-8" : "px-8 pb-8 sm:px-10 sm:pb-10")}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
