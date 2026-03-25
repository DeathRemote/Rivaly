import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type RecentPerformanceItem = {
  id: string;
  match: {
    id: string;
    kickoffAt: string;
    status: string;
    home: { name: string };
    away: { name: string };
  };
  predicted: {
    homeScore: number;
    awayScore: number;
    source: string;
  };
  actual: { homeScore: number; awayScore: number } | null;
  points: number | null;
  updatedAt: string;
};

export function RecentPerformanceList({ items }: { items: RecentPerformanceItem[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-black tracking-tight text-white">
          Recent performance
        </h3>

        <div className="flex gap-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-lime-300" />
            Positive
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Neutral/low
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-6 text-white/60">No predictions yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <RecentRow key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentRow({ item }: { item: RecentPerformanceItem }) {
  const kickoff = new Date(item.match.kickoffAt);

  const pointsLabel =
    item.points === null ? "—" : item.points > 0 ? `+${item.points} pts` : `${item.points} pts`;

  const tone = item.points === null ? "muted" : item.points >= 12 ? "good" : "ok";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/25 p-5",
        "hover:bg-white/5 transition-colors",
        tone === "good" && "border-l-4 border-lime-300/80",
        tone === "ok" && "border-l-4 border-orange-300/70",
      )}
    >
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h4 className="font-bold text-white truncate">
            {item.match.home.name} <span className="text-white/25">vs</span> {item.match.away.name}
          </h4>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            {kickoff.toLocaleString(undefined, {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">
              Prediction
            </p>
            <p className="text-sm font-bold text-white">
              {item.predicted.homeScore}-{item.predicted.awayScore}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">
              Result
            </p>
            <p className="text-sm font-bold text-white">
              {item.actual ? `${item.actual.homeScore}-${item.actual.awayScore}` : "Pending"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">
              Points
            </p>
            <p className={cn("text-sm font-black", tone === "good" ? "text-lime-100" : "text-white")}>
              {pointsLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
