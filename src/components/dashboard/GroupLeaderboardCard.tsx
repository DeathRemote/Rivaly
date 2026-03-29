import Image from "next/image";
import Link from "next/link";

import type { LeaderboardRow } from "@/features/dashboard/mock";
import { cn } from "@/lib/cn";

function pointsFmt(points: number) {
  return new Intl.NumberFormat("en-US").format(points);
}

export function GroupLeaderboardCard({
  groupName,
  rows,
  spotlightMeta,
}: {
  groupName: string;
  rows: LeaderboardRow[];
  spotlightMeta?: { needsToPredictCount: number; groupId: string };
}) {
  return (
    <section className="rounded-xl bg-white/5 p-8">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h3 className="font-display text-2xl font-black italic uppercase tracking-tight">
            {groupName}
          </h3>

          {spotlightMeta ? (
            <p className="mt-2 text-xs font-medium text-white/60">
              You still have <span className="text-white font-bold">{spotlightMeta.needsToPredictCount}</span> match
              {spotlightMeta.needsToPredictCount === 1 ? "" : "es"} to predict in this group.
            </p>
          ) : null
          }

          <div className="mt-4 space-y-4">
            {rows.map((row) => {
              const leftBorder =
                row.accent === "lime"
                  ? "border-l-lime-300"
                  : row.accent === "cyan"
                    ? "border-l-cyan-300"
                    : "border-l-transparent";

              return (
                <div
                  key={row.position}
                  className={cn(
                    "flex items-center justify-between rounded-lg p-3",
                    row.accent === "dim" ? "bg-white/5 opacity-60" : "bg-black/20",
                    "border-l-4",
                    leftBorder,
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "font-display font-black italic",
                        row.accent === "lime"
                          ? "text-lime-300"
                          : row.accent === "cyan"
                            ? "text-cyan-300"
                            : "text-white/60",
                      )}
                    >
                      {String(row.position).padStart(2, "0")}
                    </span>

                    {row.isYou ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-300 text-[10px] font-black text-black">
                        YOU
                      </div>
                    ) : (
                      <div className="relative h-8 w-8 overflow-hidden rounded-full bg-white/10">
                        <Image
                          // Use PNG to avoid Next/Image SVG restrictions.
                          src={`https://api.dicebear.com/9.x/identicon/png?size=64&seed=${encodeURIComponent(row.name)}`}
                          alt={row.name}
                          fill
                        />
                      </div>
                    )}

                    <span className="text-sm font-bold">{row.name}</span>
                  </div>

                  <span
                    className={cn(
                      "text-sm font-black",
                      row.accent === "lime"
                        ? "text-lime-300"
                        : row.accent === "cyan"
                          ? "text-cyan-300"
                          : "text-white/60",
                    )}
                  >
                    {pointsFmt(row.xp)} PTS
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:w-1/3 rounded-xl border border-white/10 bg-black/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-300">
            <span className="font-display text-3xl font-black">#</span>
          </div>
          <h4 className="font-display text-xl font-black italic">CLIMB THE LADDER</h4>
          <p className="mt-2 text-xs font-medium text-white/60">
            You’re close to the next spot. Keep predicting.
          </p>
          <Link
            href={spotlightMeta ? `/groups/${spotlightMeta.groupId}` : "/groups"}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-lime-300/30 px-8 py-3 text-xs font-black uppercase tracking-[0.18em] text-lime-100 hover:bg-lime-300/5"
          >
            {spotlightMeta ? "Open Group" : "View All Groups"}
          </Link>
        </div>
      </div>
    </section>
  );
}
