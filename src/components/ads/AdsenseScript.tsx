"use client";

import { useEffect } from "react";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4406678040423469";

/**
 * Loads the AdSense script on the client only.
 *
 * Why: AdSense may rewrite/replace the <script> tag before React hydration,
 * which can cause hydration attribute mismatch warnings in Next/React.
 */
export function AdsenseScript() {
  useEffect(() => {
    // Avoid double-inject.
    const existing = document.querySelector(`script[src^="${ADSENSE_SRC}"]`);
    if (existing) return;

    const s = document.createElement("script");
    s.src = ADSENSE_SRC;
    s.async = true;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);

    return () => {
      // We generally do NOT remove AdSense script on unmount.
      // (Next.js app layout can remount in dev; removing it can cause flicker.)
    };
  }, []);

  return null;
}
