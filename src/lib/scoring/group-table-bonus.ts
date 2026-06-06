import type { Prisma } from "@prisma/client";

export type GroupTableBonusConfig = {
  exactPositionPoints: number; // per team
  qualifierPoints: number; // per qualified team (top2)
};

export type GroupTableBonusResult = {
  userId: string;
  points: number;
  breakdown: {
    exactPositionPoints: number;
    qualifierPoints: number;
  };
};

type TeamStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
};

function emptyStats(): TeamStats {
  return { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
}

function applyPred(statsByTeam: Map<string, TeamStats>, homeTeamId: string, awayTeamId: string, home: number, away: number) {
  const homeStats = statsByTeam.get(homeTeamId) ?? emptyStats();
  const awayStats = statsByTeam.get(awayTeamId) ?? emptyStats();

  homeStats.played += 1;
  awayStats.played += 1;

  homeStats.gf += home;
  homeStats.ga += away;
  awayStats.gf += away;
  awayStats.ga += home;

  if (home > away) {
    homeStats.wins += 1;
    awayStats.losses += 1;
  } else if (home < away) {
    awayStats.wins += 1;
    homeStats.losses += 1;
  } else {
    homeStats.draws += 1;
    awayStats.draws += 1;
  }

  statsByTeam.set(homeTeamId, homeStats);
  statsByTeam.set(awayTeamId, awayStats);
}

function pointsFromStats(s: TeamStats) {
  return s.wins * 3 + s.draws;
}

function gdFromStats(s: TeamStats) {
  return s.gf - s.ga;
}

export function computeGroupTableBonus(opts: {
  config: GroupTableBonusConfig;
  teamIds: string[];
  teamNameById: Map<string, string>;
  actualPositionByTeamId: Map<string, number>; // 1..4
  actualTop2: Set<string>;
  predictions: Array<{
    userId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
  }>;
}): GroupTableBonusResult[] {
  const { config, teamIds, teamNameById, actualPositionByTeamId, actualTop2, predictions } = opts;

  const byUser = new Map<string, Array<(typeof predictions)[number]>>();
  for (const p of predictions) {
    const arr = byUser.get(p.userId) ?? [];
    arr.push(p);
    byUser.set(p.userId, arr);
  }

  const results: GroupTableBonusResult[] = [];

  for (const [userId, preds] of byUser.entries()) {
    const statsByTeam = new Map<string, TeamStats>();
    for (const tid of teamIds) statsByTeam.set(tid, emptyStats());

    for (const p of preds) {
      applyPred(statsByTeam, p.homeTeamId, p.awayTeamId, p.homeScore, p.awayScore);
    }

    const ordered = [...statsByTeam.entries()].map(([teamId, stats]) => {
      const points = pointsFromStats(stats);
      const gd = gdFromStats(stats);
      const gf = stats.gf;
      const name = teamNameById.get(teamId) ?? teamId;
      return { teamId, points, gd, gf, name };
    });

    ordered.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });

    const predictedPositionByTeamId = new Map<string, number>();
    for (let i = 0; i < ordered.length; i++) predictedPositionByTeamId.set(ordered[i].teamId, i + 1);

    const predictedTop2 = new Set(ordered.slice(0, 2).map((r) => r.teamId));

    let exactPositionPoints = 0;
    for (const tid of teamIds) {
      const actualPos = actualPositionByTeamId.get(tid);
      const predPos = predictedPositionByTeamId.get(tid);
      if (actualPos && predPos && actualPos === predPos) exactPositionPoints += config.exactPositionPoints;
    }

    let qualifierPoints = 0;
    for (const tid of actualTop2) {
      if (predictedTop2.has(tid)) qualifierPoints += config.qualifierPoints;
    }

    const points = exactPositionPoints + qualifierPoints;
    results.push({ userId, points, breakdown: { exactPositionPoints, qualifierPoints } });
  }

  // Also include users with zero predictions (so they can be explicitly skipped upstream if desired).
  // (No-op here.)

  return results;
}

export function groupTableBonusMeta(opts: {
  competitionGroupId: string;
  breakdown: GroupTableBonusResult["breakdown"];
}): Prisma.JsonObject {
  return {
    model: "group_table_bonus_v1",
    competitionGroupId: opts.competitionGroupId,
    breakdown: opts.breakdown,
  };
}
