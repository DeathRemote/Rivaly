export function GroupMomentumCard() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
        Group Momentum
      </h4>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-black/20">
        <div className="h-full w-[15%] bg-[#d53d18]" title="Low confidence" />
        <div className="h-full w-[25%] bg-orange-300" title="Medium confidence" />
        <div className="h-full w-[60%] bg-lime-200" title="High confidence" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
          Risk Level: HIGH
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-lime-200">
          Predictive Edge: 78%
        </span>
      </div>
    </section>
  );
}
