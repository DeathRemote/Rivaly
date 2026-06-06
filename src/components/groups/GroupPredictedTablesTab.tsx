import { prisma } from "@/lib/prisma";

import { StandingsMiniTable } from "@/components/tables/StandingsMiniTable";

type Row = {
  teamId: string;
  teamName: string;
  position: number;
  played: number;
  goalDifference: number;
  points: number;
};

type TeamStats = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
};

function ensureTeam(stats: Map<string, TeamStats>, team: { id: string; name: string }) {
  if (stats.has(team.id)) return;
  stats.set(team.id, {
    teamId: team.id,
    teamName: team.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
  });
}

function applyPrediction(
  stats: Map<string, TeamStats>,
  match: { homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string } },
  pred: { homeScore: number; awayScore: number },
) {
  ensureTeam(stats, match.homeTeam);
  ensureTeam(stats, match.awayTeam);

  const home = stats.get(match.homeTeam.id)!;
  const away = stats.get(match.awayTeam.id)!;

  home.played += 1;
  away.played += 1;

  home.gf += pred.homeScore;
  home.ga += pred.awayScore;
  away.gf += pred.awayScore;
  away.ga += pred.homeScore;

  if (pred.homeScore > pred.awayScore) {
    home.wins += 1;
    away.losses += 1;
  } else if (pred.homeScore < pred.awayScore) {
    away.wins += 1;
    home.losses += 1;
  } else {
    home.draws += 1;
    away.draws += 1;
  }
}

function toRows(stats: TeamStats[]): Row[] {
  const enriched = stats.map((t) => {
    const points = t.wins * 3 + t.draws;
    const gd = t.gf - t.ga;
    return { ...t, points, gd };
  });

  enriched.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName);
  });

  return enriched.map((t, idx) => ({
    teamId: t.teamId,
    teamName: t.teamName,
    position: idx + 1,
    played: t.played,
    goalDifference: t.gd,
    points: t.points,
  }));
}

export async function GroupPredictedTablesTab({
  competitionSeasonId,
  viewerUserId,
}: {
  competitionSeasonId: string;
  viewerUserId: string;
}) {
  if (!competitionSeasonId) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        No competition season linked to this group.
      </div>
    );
  }

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

  const groups = await prisma.competitionGroup.findMany({
    where: { competitionPhase: { competitionSeasonId } },
    orderBy: [{ order: "asc" }, { key: "asc" }],
    select: { id: true, key: true, name: true, order: true },
  });

  if (!groups.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        No group stage found for this competition.
      </div>
    );
  }

  const groupIds = groups.map((g) => g.id);

  // Preload the official team list per group (from real standings rows). This keeps the UI stable
  // even if the user hasn't predicted any match yet.
  const officialRows = await prisma.standingsRow.findMany({
    where: { competitionSeasonId, competitionGroupId: { in: groupIds } },
    select: {
      competitionGroupId: true,
      team: { select: { id: true, name: true } },
    },
  });

  const teamsByGroup = new Map<string, { id: string; name: string }[]>();
  for (const r of officialRows) {
    const gid = r.competitionGroupId;
    if (!gid) continue;
    const arr = teamsByGroup.get(gid) ?? [];
    if (!arr.some((t) => t.id === r.team.id)) arr.push(r.team);
    teamsByGroup.set(gid, arr);
  }

  // Load all predictions for group-stage matches in this season.
  const preds = await prisma.prediction.findMany({
    where: {
      userId: viewerUserId,
      match: {
        competitionSeasonId,
        competitionGroupId: { not: null },
      },
    },
    select: {
      homeScore: true,
      awayScore: true,
      match: {
        select: {
          competitionGroupId: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      },
    },
  });

  const statsByGroup = new Map<string, Map<string, TeamStats>>();
  for (const g of groups) {
    statsByGroup.set(g.id, new Map());
    const officialTeams = teamsByGroup.get(g.id) ?? [];
    for (const t of officialTeams) ensureTeam(statsByGroup.get(g.id)!, t);
  }

  for (const p of preds) {
    const gid = p.match.competitionGroupId;
    if (!gid) continue;
    const map = statsByGroup.get(gid);
    if (!map) continue;
    applyPrediction(map, { homeTeam: p.match.homeTeam, awayTeam: p.match.awayTeam }, { homeScore: p.homeScore, awayScore: p.awayScore });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Predicted table</div>
            <h3 className="mt-1 font-display text-xl font-black italic tracking-tight text-white">{season.competition.name}</h3>
            <p className="mt-2 text-sm font-medium text-white/60">
              Group standings simulated from your score predictions. Unpredicted matches are ignored.
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{groups.length} groups</div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map((g) => {
            const stats = statsByGroup.get(g.id);
            const rows = stats ? toRows([...stats.values()]) : [];
            return (
              <div key={g.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{g.name}</div>
                {rows.length ? (
                  <StandingsMiniTable rows={rows} />
                ) : (
                  <div className="mt-3 text-sm font-medium text-white/55">No predictions yet.</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
