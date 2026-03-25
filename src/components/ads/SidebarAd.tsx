"use client";

import { useEffect, useMemo, useRef } from "react";

import { ADSENSE_CLIENT, ADSENSE_SIDEBAR_SLOT } from "@/lib/adsense";
import { cn } from "@/lib/cn";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function SidebarAd({
  slot = ADSENSE_SIDEBAR_SLOT,
  className,
  format = "auto",
}: {
  slot?: string;
  className?: string;
  /** AdSense recommended: "auto" for responsive manual units */
  format?: string;
}) {
  const hasPushedRef = useRef(false);

  // Stable key so AdSense doesn't get re-initialized just because React re-rendered.
  const adKey = useMemo(() => `sidebar-ad:${slot ?? "missing"}`, [slot]);

  useEffect(() => {
    if (!slot) return;
    if (hasPushedRef.current) return;

    // Guard in case AdSense isn't available yet.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.adsbygoogle = (window.adsbygoogle || [])) as any;
      window.adsbygoogle!.push({});
      hasPushedRef.current = true;
    } catch {
      // Ignore; AdSense may fail in local/dev or with blockers.
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4",
        "text-white/50",
        className,
      )}
    >
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
        Advertisement
      </div>

      {/*
        Reserve space to avoid layout shift.
        We keep a minimum height even before the ad loads.
      */}
      <div className="min-h-[250px]">
        {/*
          Manual AdSense unit.
          Note: global AdSense script is loaded in app/layout.tsx.
        */}
        <ins
          key={adKey}
          className="adsbygoogle"
          style={{ display: "block", minHeight: 250 }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>

    </div>
  );
}
