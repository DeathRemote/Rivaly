export type Score = { home: number; away: number };

export function winnerOf(s: Score): "HOME" | "AWAY" | "DRAW" {
  if (s.home === s.away) return "DRAW";
  return s.home > s.away ? "HOME" : "AWAY";
}

export function totalGoalError(pred: Score, actual: Score): number {
  return Math.abs(pred.home - actual.home) + Math.abs(pred.away - actual.away);
}

export function scorePredictionPoints(opts: { predicted: Score; actual: Score }): {
  points: number;
  reason: string;
  meta: { model: "tiered_v1"; winnerCorrect: boolean; error: number };
} {
  const { predicted, actual } = opts;

  const error = totalGoalError(predicted, actual);
  const winnerCorrect = winnerOf(predicted) === winnerOf(actual);

  if (error === 0) {
    return {
      points: 15,
      reason: "Exact score",
      meta: { model: "tiered_v1", winnerCorrect: true, error },
    };
  }

  if (!winnerCorrect) {
    return {
      points: 0,
      reason: "Wrong winner",
      meta: { model: "tiered_v1", winnerCorrect: false, error },
    };
  }

  let points = 5;
  if (error === 1) points = 10;
  else if (error === 2) points = 8;
  else if (error === 3) points = 6;
  else points = 5;

  return {
    points,
    reason: `Correct winner (error ${error})`,
    meta: { model: "tiered_v1", winnerCorrect: true, error },
  };
}

export function scoreKnockoutPredictionPoints(opts: {
  predicted: Score;
  actual: Score;
  homeTeamId: string;
  awayTeamId: string;
  predictedAdvancesTeamId?: string | null;
  actualAdvancesTeamId?: string | null;
}): {
  points: number;
  reason: string;
  meta: {
    model: "tiered_v1_knockout";
    winnerCorrect: boolean;
    error: number;
  };
} {
  const { predicted, actual } = opts;

  // Knockout scoring (simplified): score ONLY the 90/120 scoreline.
  // Users may still pick an advances team for bracket purposes, but it does not affect points.
  const base = scorePredictionPoints({ predicted, actual });
  return {
    points: base.points,
    reason: base.reason,
    meta: {
      model: "tiered_v1_knockout",
      winnerCorrect: base.meta.winnerCorrect,
      error: base.meta.error,
    },
  };
}
