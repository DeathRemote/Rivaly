export function RecentResultCard() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
          Completed Match
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-200">
          WON +450 PTS
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 opacity-80">
        <div className="flex flex-1 items-center gap-3">
          <div className="h-10 w-10 rounded-lg border border-white/10 bg-black/20" />
          <span className="font-display text-sm font-black italic text-white">Real Madrid</span>
        </div>
        <div className="font-display text-2xl font-black tracking-tighter text-white">1 - 0</div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <span className="font-display text-sm font-black italic text-white">RB Leipzig</span>
          <div className="h-10 w-10 rounded-lg border border-white/10 bg-black/20" />
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Your Prediction
          </span>
          <span className="font-display text-sm font-black italic text-lime-100">Win (1.54)</span>
        </div>
      </div>
    </section>
  );
}
