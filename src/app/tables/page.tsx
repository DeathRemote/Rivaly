import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Table = {
  seasonId: string;
  title: string;
  rows: Array<{ teamId: string; teamName: string; position: number; played: number; goalDifference: number; points: number }>;
};

async function getRelevantTables(userId: string): Promise<Table[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: {
      competitionSeasonId: true,
      competitionSeason: {
        select: {
          id: true,
          seasonLabel: true,
          competition: { select: { name: true } },
        },
      },
    },
  });

  const seasons = groups
    .map((g) => g.competitionSeason)
    .filter(Boolean) as Array<{ id: string; seasonLabel: string; competition: { name: string } }>;

  // Deduplicate by competition season id.
  const unique = new Map<string, { id: string; seasonLabel: string; competition: { name: string } }>();
  for (const s of seasons) {
    if (!unique.has(s.id)) unique.set(s.id, s);
  }

  const seasonList = [...unique.values()];
  if (seasonList.length === 0) return [];

  const standings = await prisma.standingsRow.findMany({
    where: { competitionSeasonId: { in: seasonList.map((s) => s.id) } },
    orderBy: [{ competitionSeasonId: "asc" }, { position: "asc" }],
    select: {
      competitionSeasonId: true,
      teamId: true,
      position: true,
      played: true,
      goalDifference: true,
      points: true,
      team: { select: { name: true, shortName: true } },
    },
  });

  const bySeason = new Map<string, Table>();
  for (const s of seasonList) {
    bySeason.set(s.id, {
      seasonId: s.id,
      title: `${s.competition.name} ${s.seasonLabel}`,
      rows: [],
    });
  }

  for (const r of standings) {
    const t = bySeason.get(r.competitionSeasonId);
    if (!t) continue;
    t.rows.push({
      teamId: r.teamId,
      teamName: r.team.shortName ?? r.team.name,
      position: r.position,
      played: r.played,
      goalDifference: r.goalDifference,
      points: r.points,
    });
  }

  return [...bySeason.values()].filter((t) => t.rows.length > 0);
}

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/tables");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/tables");

  const tables = await getRelevantTables(userId);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:py-10">
      <div className="mb-8">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
          Tables
        </div>
        <h1 className="mt-2 font-display text-4xl font-black italic tracking-tight text-white">
          League Tables
        </h1>
        <p className="mt-2 text-sm font-medium text-white/60">
          Tables are shown only for leagues tied to your groups.
        </p>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
          No tables available yet.
        </div>
      ) : (
        <div className="space-y-6">
          {tables.map((t) => (
            <section key={t.seasonId} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                    Competition
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-black italic tracking-tight text-white">
                    {t.title}
                  </h2>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  {t.rows.length} teams
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Team</th>
                      <th className="py-2 pr-3">P</th>
                      <th className="py-2 pr-3">GD</th>
                      <th className="py-2">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-white/70">
                    {t.rows.map((r) => (
                      <tr key={r.teamId} className="border-t border-white/10">
                        <td className="py-2 pr-3 tabular-nums text-white/45">{r.position}</td>
                        <td className="py-2 pr-3 font-semibold text-white/80">{r.teamName}</td>
                        <td className="py-2 pr-3 tabular-nums text-white/55">{r.played}</td>
                        <td className="py-2 pr-3 tabular-nums text-white/55">{r.goalDifference}</td>
                        <td className="py-2 tabular-nums font-bold text-lime-100">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
