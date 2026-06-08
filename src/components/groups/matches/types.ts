export type PhaseType = "LEAGUE" | "GROUP_STAGE" | "KNOCKOUT";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELED";

export type MatchPredictionStatus =
  | "NOT_PREDICTED"
  | "PREDICTED"
  | "LOCKED"
  | "COMPLETED";

export type MatchListItem = {
  id: string; // matchId (stable id for predictions)
  phaseType: PhaseType;
  phaseLabel: string; // e.g. "Gameweek 12" / "Group A" / "Quarterfinal"
  kickoffAt: string; // ISO
  lockAt: string; // ISO
  visibleAt: string; // ISO
  status: MatchStatus;
  homeTeamId?: string;
  awayTeamId?: string;
  home: { name: string; shortName?: string; badge?: string };
  away: { name: string; shortName?: string; badge?: string };
  competitionLabel?: string;
  userPrediction?: {
    status: MatchPredictionStatus;
    summary?: string; // e.g. "2-1" or "1-1 (adv: Team)"
    homeScore?: number;
    awayScore?: number;

    // Knockout-only: present when the user predicted a draw and chose who advances.
    advancesTeamId?: string | null;

    source?: "QUICK_PICK" | "SCORE";
    updatedAt?: string;
  };
  result?: {
    homeScore: number;
    awayScore: number;
  };
};

// kickoff    = matches currently open for prediction (visibleAt <= now < lockAt)
// upcoming   = all future matches outside the current prediction window
// completed  = matches that are completed (FINAL)
export type MatchesView = "kickoff" | "upcoming" | "completed";
