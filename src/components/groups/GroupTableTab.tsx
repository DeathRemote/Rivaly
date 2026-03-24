import { prisma } from "@/lib/prisma";

export async function GroupTableTab({ competitionSeasonId }: { competitionSeasonId: string }) {
  const season = await prisma.competitionSeason.findUnique({
    where: { id: competitionSeasonId },
    include: { competition: true },
  });

  if (!season) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        No competition season linked to this group.
      </div>
    );
  }

  const rows = await prisma.standingsRow.findMany({
    where: { competitionSeasonId },
    include: { team: true },
    orderBy: { position: "asc" },
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
            Table
          </div>
          <h3 className="mt-2 font-display text-2xl font-black italic tracking-tight text-white">
            {season.competition.name} {season.seasonLabel}
          </h3>
          <p className="mt-1 text-sm font-medium text-white/60">
            Real-world standings (stored per competition season).
          </p>
        </div>
        <div className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
          Updated {season.standingsUpdatedAt ? new Date(season.standingsUpdatedAt).toLocaleString() : "—"}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 text-sm text-white/60">
          No standings stored yet. (Run a standings sync for this season.)
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-left text-white/60">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">P</th>
                <th className="px-4 py-3">W</th>
                <th className="px-4 py-3">D</th>
                <th className="px-4 py-3">L</th>
                <th className="px-4 py-3">GD</th>
                <th className="px-4 py-3">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/10 text-white/80">
                  <td className="px-4 py-3 font-black text-white">{r.position}</td>
                  <td className="px-4 py-3 font-semibold">{r.team.name}</td>
                  <td className="px-4 py-3">{r.played}</td>
                  <td className="px-4 py-3">{r.wins}</td>
                  <td className="px-4 py-3">{r.draws}</td>
                  <td className="px-4 py-3">{r.losses}</td>
                  <td className="px-4 py-3">{r.goalDifference}</td>
                  <td className="px-4 py-3 font-black text-lime-100">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
