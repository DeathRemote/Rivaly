import { cn } from "@/lib/cn";
import type { CompletedMatchItem } from "@/lib/group-stats";

export function CompletedMatchesFeed({
  items,
}: {
  items: CompletedMatchItem[];
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
          Completed matches
        </h4>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
          Recent
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/55">
          No scored matches yet for this group.
        </div>
      ) : (
        <div className="max-h-[620px] overflow-y-auto space-y-4 pr-1">
          {items.map((m) => (
            <CompletedMatchCard key={m.matchId} item={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function CompletedMatchCard({ item }: { item: CompletedMatchItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-sm font-black italic text-white truncate">
            {item.home}
            <span className="mx-2 text-white/20">vs</span>
            {item.away}
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            Final
          </div>
        </div>
        <div className="font-display text-2xl font-black text-lime-100 whitespace-nowrap">
          {item.finalScoreLabel}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {item.outcomes.length === 0 ? (
          <div className="text-xs text-white/50">No scored predictions found.</div>
        ) : (
          item.outcomes.map((o) => (
            <div
              key={o.userId}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2",
                o.correctness === "exact"
                  ? "bg-lime-300/10 border border-lime-300/20"
                  : o.correctness === "correct"
                    ? "bg-white/5 border border-white/10"
                    : "bg-orange-500/10 border border-orange-500/20",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-white">{o.name}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Pred {o.predictionLabel}
                </div>
              </div>

              <div className="text-right">
                <div
                  className={cn(
                    "text-xs font-black",
                    o.correctness === "exact"
                      ? "text-lime-200"
                      : o.correctness === "correct"
                        ? "text-white/70"
                        : "text-orange-200",
                  )}
                >
                  {o.correctness === "exact" ? "EXACT" : o.correctness === "correct" ? "RIGHT" : "WRONG"}
                </div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  {o.points >= 0 ? "+" : ""}
                  {o.points} pts
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
