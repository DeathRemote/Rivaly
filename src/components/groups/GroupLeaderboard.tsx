import { LeaderboardRow, type LeaderboardRowData } from "@/components/groups/LeaderboardRow";

export function GroupLeaderboard({
  rows,
}: {
  rows: LeaderboardRowData[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-1 overflow-hidden">
      <div className="grid grid-cols-12 px-6 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/40 border-b border-white/10">
        <div className="col-span-1">Rk</div>
        <div className="col-span-5">Competitor</div>
        <div className="col-span-2 text-right">Points</div>
        <div className="col-span-2 text-right">Acc %</div>
        <div className="col-span-2 text-center">Trend</div>
      </div>

      <div className="mt-2 max-h-[620px] overflow-y-auto">
        {rows.length ? (
          <div className="space-y-1">
            {rows.map((row) => (
              <LeaderboardRow key={row.rank} row={row} />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-white/50">No members yet.</div>
        )}
      </div>
    </section>
  );
}
