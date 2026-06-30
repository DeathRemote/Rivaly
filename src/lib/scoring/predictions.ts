export type Score = { home: number; away: number };

export function winnerOf(s: Score): "HOME" | "AWAY" | "DRAW" {
  if (s.home === s.away) return "DRAW";
  return s.home > s.away ? "HOME" : "AWAY";
}

export function totalGoalError(pred: Score, actual: Score): number {
  return Math.abs(pred.home - actual.home) + Math.abs(pred.away - actual.away);
}

// Base scoring model used for league + group stage (and for knockout matches that are decided
// within extra time without penalties).
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

  // Tiered scoring: simple + explainable.
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
    advancesCorrect?: boolean;
  };
} {
  const { predicted, actual, predictedAdvancesTeamId, actualAdvancesTeamId } = opts;

  // If the actual match is NOT a draw, use base scoring.
  if (actual.home !== actual.away) {
    const base = scorePredictionPoints({ predicted, actual });
    return {
      points: base.points,
      reason: base.reason,
      meta: { model: "tiered_v1_knockout", winnerCorrect: base.meta.winnerCorrect, error: base.meta.error },
    };
  }

  // Actual is a draw (after 120). In knockout, the advancing team matters.
  // If we don't know who advanced yet, we can't fairly score this match.
  if (!actualAdvancesTeamId) {
    return {
      points: 0,
      reason: "Awaiting penalty winner",
      meta: { model: "tiered_v1_knockout", winnerCorrect: false, error: totalGoalError(predicted, actual) },
    };
  }

  // If user didn't predict a draw, it's wrong in knockout terms.
  if (predicted.home !== predicted.away) {
    return {
      points: 0,
      reason: "Wrong outcome (match went to penalties)",
      meta: { model: "tiered_v1_knockout", winnerCorrect: false, error: totalGoalError(predicted, actual) },
    };
  }

  const advancesCorrect =
    Boolean(predictedAdvancesTeamId) && predictedAdvancesTeamId === actualAdvancesTeamId;

  if (!advancesCorrect) {
    return {
      points: 0,
      reason: "Wrong team advanced",
      meta: {
        model: "tiered_v1_knockout",
        winnerCorrect: false,
        advancesCorrect,
        error: totalGoalError(predicted, actual),
      },
    };
  }

  // Advances is correct; award tiered points based on score error (draw scoreline).
  const error = totalGoalError(predicted, actual);
  if (error === 0) {
    return {
      points: 15,
      reason: "Exact score + correct team advanced",
      meta: { model: "tiered_v1_knockout", winnerCorrect: true, advancesCorrect, error },
    };
  }

  let points = 5;
  if (error === 1) points = 10;
  else if (error === 2) points = 8;
  else if (error === 3) points = 6;
  else points = 5;

  return {
    points,
    reason: `Correct team advanced (error ${error})`,
    meta: { model: "tiered_v1_knockout", winnerCorrect: true, advancesCorrect, error },
  };
}
