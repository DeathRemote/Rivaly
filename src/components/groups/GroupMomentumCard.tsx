export function GroupMomentumCard({
  momentum,
}: {
  momentum: {
    momentumPct: number;
    riskLabel: string;
    accuracyPct: number;
    activityScore: number;
    windowDays: number;
    explanation: string;
  };
}) {
  const pct = Math.max(0, Math.min(100, momentum.momentumPct));

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
        Group Momentum
      </h4>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-black/20">
        <div className="h-full bg-[#d53d18]" style={{ width: `${Math.min(33, pct)}%` }} title="Low" />
        <div
          className="h-full bg-orange-300"
          style={{ width: `${Math.max(0, Math.min(33, pct - 33))}%` }}
          title="Medium"
        />
        <div
          className="h-full bg-lime-200"
          style={{ width: `${Math.max(0, pct - 66)}%` }}
          title="High"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
          Risk Level: {momentum.riskLabel}
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-lime-200">
          Momentum: {pct}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Accuracy ({momentum.windowDays}D)
          </div>
          <div className="mt-2 font-display text-xl font-black text-white">{momentum.accuracyPct}%</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Activity ({momentum.windowDays}D)
          </div>
          <div className="mt-2 font-display text-xl font-black text-white">
            {momentum.activityScore}%
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">{momentum.explanation}</p>
    </section>
  );
}
