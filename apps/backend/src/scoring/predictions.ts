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

export const KNOCKOUT_ADVANCES_BONUS_POINTS = 5;

export function scoreKnockoutPredictionPoints(opts: {
  predicted: Score;
  actual: Score;
  homeTeamId: string;
  awayTeamId: string;
  predictedAdvancesTeamId?: string | null;
  actualAdvancesTeamId?: string | null;
}): {
  basePoints: number;
  bonusPoints: number;
  baseReason: string;
  bonusReason: string | null;
  awaitingAdvances: boolean;
  meta: {
    model: "tiered_v1_knockout_v2";
    base: { winnerCorrect: boolean; error: number };
    bonus?: { advancesCorrect: boolean };
  };
} {
  const { predicted, actual, predictedAdvancesTeamId, actualAdvancesTeamId } = opts;

  // Base points are ALWAYS scored against the 90/120 scoreline (including draws).
  const base = scorePredictionPoints({ predicted, actual });

  // No bonus unless the match is a draw (after 120) AND we know who advanced.
  if (actual.home !== actual.away) {
    return {
      basePoints: base.points,
      bonusPoints: 0,
      baseReason: base.reason,
      bonusReason: null,
      awaitingAdvances: false,
      meta: {
        model: "tiered_v1_knockout_v2",
        base: { winnerCorrect: base.meta.winnerCorrect, error: base.meta.error },
      },
    };
  }

  // Draw in knockout: bonus for correctly predicting who advances on pens.
  if (!actualAdvancesTeamId) {
    return {
      basePoints: base.points,
      bonusPoints: 0,
      baseReason: base.reason,
      bonusReason: null,
      awaitingAdvances: true,
      meta: {
        model: "tiered_v1_knockout_v2",
        base: { winnerCorrect: base.meta.winnerCorrect, error: base.meta.error },
      },
    };
  }

  const predictedIsDraw = predicted.home === predicted.away;
  const advancesCorrect =
    predictedIsDraw && Boolean(predictedAdvancesTeamId) && predictedAdvancesTeamId === actualAdvancesTeamId;

  const bonusPoints = advancesCorrect ? KNOCKOUT_ADVANCES_BONUS_POINTS : 0;

  return {
    basePoints: base.points,
    bonusPoints,
    baseReason: base.reason,
    bonusReason: advancesCorrect ? `Correct team advanced (+${KNOCKOUT_ADVANCES_BONUS_POINTS})` : null,
    awaitingAdvances: false,
    meta: {
      model: "tiered_v1_knockout_v2",
      base: { winnerCorrect: base.meta.winnerCorrect, error: base.meta.error },
      bonus: { advancesCorrect },
    },
  };
}
