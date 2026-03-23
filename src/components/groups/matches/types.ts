export type PhaseType = "LEAGUE" | "GROUP_STAGE" | "KNOCKOUT";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELED";

export type MatchPredictionStatus =
  | "NOT_PREDICTED"
  | "PREDICTED"
  | "LOCKED"
  | "COMPLETED";

export type MatchListItem = {
  id: string;
  phaseType: PhaseType;
  phaseLabel: string; // e.g. "Gameweek 12" / "Group A" / "Quarterfinal"
  kickoffAt: string; // ISO
  lockAt: string; // ISO
  visibleAt: string; // ISO
  status: MatchStatus;
  home: { name: string; shortName?: string; badge?: string };
  away: { name: string; shortName?: string; badge?: string };
  competitionLabel?: string;
  userPrediction?: {
    status: MatchPredictionStatus;
    summary?: string; // e.g. "Home win" / "2-1"
    updatedAt?: string;
  };
  result?: {
    homeScore: number;
    awayScore: number;
  };
};

export type MatchesView = "upcoming" | "locked" | "completed";
