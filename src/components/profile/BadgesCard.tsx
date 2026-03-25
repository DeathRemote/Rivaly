"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

export type EarnedBadge = {
  id: string;
  title: string;
  subtitle: string;
  tone: "lime" | "cyan" | "orange";
  earnedAt: string;
};

export function BadgesCard({
  badges,
}: {
  badges: {
    latest: EarnedBadge[];
    all: EarnedBadge[];
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-xl font-black tracking-tight text-white">Badges</h3>
          <button
            type="button"
            className="text-xs font-black text-lime-100 underline underline-offset-4"
            onClick={() => setOpen(true)}
          >
            View all
          </button>
        </div>

        {badges.latest.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/55">
            No badges earned yet. Keep predicting — streaks unlock rewards.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {badges.latest.map((b) => (
              <BadgeTile key={b.id} badge={b} />
            ))}
          </div>
        )}

        <p className="text-[11px] text-white/40 leading-relaxed">
          Badge system v0: badges are derived from your activity. Later we’ll persist earned badges
          for richer progression.
        </p>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="All badges"
        description="Your earned badges (v0 derived)."
      >
        <div className="grid grid-cols-2 gap-3">
          {badges.all.length === 0 ? (
            <div className="col-span-2 text-sm text-white/60">No badges yet.</div>
          ) : (
            badges.all.map((b) => <BadgeTile key={b.id} badge={b} compact />)
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 px-4 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 font-semibold"
          >
            Close
          </button>
        </div>
      </Modal>
    </>
  );
}

function BadgeTile({
  badge,
  compact,
}: {
  badge: EarnedBadge;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4",
        "hover:bg-white/8 transition",
        compact && "p-3",
      )}
    >
      <div
        className={cn(
          "h-11 w-11 rounded-full grid place-items-center",
          badge.tone === "lime" && "bg-lime-300/15 text-lime-100",
          badge.tone === "cyan" && "bg-cyan-300/15 text-cyan-100",
          badge.tone === "orange" && "bg-orange-300/15 text-orange-100",
        )}
      >
        <span className="text-xs font-black">{badge.title.slice(0, 2).toUpperCase()}</span>
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white">
          {badge.title}
        </div>
        <div className="mt-1 text-[10px] text-white/50">{badge.subtitle}</div>
      </div>
    </div>
  );
}
