import { Card } from "@/components/ui/Card";

export function ProfileStatsGrid({
  stats,
}: {
  stats: {
    totalPredictions: number;
    accuracyPct: number;
    totalCorrect: number;
    totalWrong: number;
  };
}) {
  const accuracy = Number.isFinite(stats.accuracyPct) ? stats.accuracyPct : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        label="Total predictions"
        value={stats.totalPredictions.toLocaleString()}
        meta="All-time"
      />
      <StatCard
        label="Accuracy"
        value={`${accuracy.toFixed(1)}%`}
        meta="Correct outcome on scored matches"
        accent="lime"
      />
      <StatCard
        label="Correct"
        value={stats.totalCorrect.toLocaleString()}
        meta="Scored matches"
      />
      <StatCard
        label="Wrong"
        value={stats.totalWrong.toLocaleString()}
        meta="Scored matches"
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  meta,
  accent,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: "lime";
}) {
  return (
    <Card
      className={
        "p-6 min-h-[150px] flex flex-col justify-between " +
        (accent ? "border-l-4 border-lime-300/80" : "")
      }
    >
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
        {label}
      </span>
      <div>
        <div className={accent ? "text-lime-100" : "text-white"}>
          <p className="font-display text-4xl font-black tracking-tight">{value}</p>
        </div>
        {meta ? <p className="text-xs text-white/45 mt-1">{meta}</p> : null}
      </div>
    </Card>
  );
}
