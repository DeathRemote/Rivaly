import * as React from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ProgressBar({
  value,
  className,
  heightClassName = "h-2",
  trackClassName = "bg-black/40",
}: {
  value: number;
  className?: string;
  heightClassName?: string;
  trackClassName?: string;
}) {
  const safe = clamp(Number.isFinite(value) ? value : 0, 0, 100);

  return (
    <div
      className={
        heightClassName +
        " rounded-full overflow-hidden " +
        trackClassName +
        " " +
        (className ?? "")
      }
    >
      <div
        className="h-full bg-gradient-to-r from-[#f3ffca] to-[#beee00]"
        style={{ width: `${safe}%` }}
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
      />
    </div>
  );
}
