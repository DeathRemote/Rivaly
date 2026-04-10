import Link from "next/link";

import { cn } from "@/lib/cn";

export type GroupCardLeaderboardRow = {
  position: number;
  name: string;
  points: number;
  isYou?: boolean;
};

export type GroupCardData = {
  id: string;
  name: string;
  competition: string;
  memberCount: number;
  yourRank: number | null;
  yourPoints: number;
  top3: GroupCardLeaderboardRow[];
};

export function GroupCard({ group }: { group: GroupCardData }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      aria-label={`View group ${group.name}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6",
        "shadow-[0px_24px_48px_rgba(0,0,0,0.35)] transition",
        "hover:-translate-y-1 hover:bg-white/[0.07]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime-300/10 blur-[70px]" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-orange-300/10 blur-[70px]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-black italic tracking-tight text-lime-100">
              {group.name}
            </h3>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                {group.competition}
              </span>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
              {group.memberCount} members
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Your Rank" value={group.yourRank ? `#${group.yourRank}` : "—"} tone="orange" />
          <Stat label="Total Pts" value={group.yourPoints.toLocaleString()} tone="lime" />
          <Stat label="Top Rivals" value={Math.min(group.top3.length, 3).toString()} tone="cyan" />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            <span>Top 3</span>
            <span>Points</span>
          </div>

          <div className="space-y-2">
            {group.top3.length ? (
              group.top3.map((row) => (
                <div
                  key={row.position}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2",
                    "transition group-hover:bg-black/30",
                    row.isYou && "border-lime-300/30 bg-lime-300/5",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "font-display text-xs font-black",
                        row.position === 1 ? "text-lime-200" : "text-white/30",
                      )}
                    >
                      {String(row.position).padStart(2, "0")}
                    </span>
                    <span className={cn("text-sm font-bold", row.isYou ? "text-lime-100" : "text-white/80")}>
                      {row.name}
                    </span>
                  </div>
                  <span className="text-sm font-black text-white/80">
                    {row.points.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/50">
                No leaderboard data yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div
            className={cn(
              "inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-black/20 py-3",
              "text-xs font-black uppercase tracking-[0.22em] text-lime-100",
              "transition group-hover:border-lime-300/40 group-hover:bg-lime-300/10",
              "active:scale-[0.99]",
            )}
          >
            View Group
          </div>
        </div>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "lime" | "orange" | "cyan";
}) {
  const valueClass =
    tone === "lime" ? "text-lime-200" : tone === "orange" ? "text-orange-200" : "text-cyan-200";

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className={cn("mt-1 font-display text-2xl font-black italic tracking-tight", valueClass)}>
        {value}
      </div>
    </div>
  );
}
