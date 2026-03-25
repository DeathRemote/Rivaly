export type DashboardNavItem = {
  label: string;
  href: string;
  key: "dashboard" | "swipe" | "groups" | "tables" | "profile" | "admin";
};

export type GlobalStanding = {
  rankNumber: number;
  percentile: number;
  tierLabel: string;
  winStreak: number;
};

export type LastResult = {
  leftTeam: string;
  rightTeam: string;
  resultLabel: "WIN" | "LOSS";
  deltaPoints: number;
};

export type MatchCard = {
  id: string;
  badge: { label: string; variant: "live" | "time" | "social" };
  leagueLabel: string;
  left: { name: string; sport: "soccer" | "basketball" | "tennis" };
  right: { name: string; sport: "soccer" | "basketball" | "tennis" };
  metric: { label: string; valueLabel: string; value: number; color: "lime" | "orange" | "cyan" };
};

export type LeaderboardRow = {
  position: number;
  name: string;
  xp: number;
  isYou?: boolean;
  accent: "lime" | "cyan" | "dim";
};

export const mockStanding: GlobalStanding = {
  rankNumber: 42,
  percentile: 2,
  tierLabel: "Pro Rank",
  winStreak: 8,
};

export const mockLastResult: LastResult = {
  leftTeam: "LAKERS",
  rightTeam: "CELTICS",
  resultLabel: "WIN",
  deltaPoints: 1240,
};

export const mockMatches: MatchCard[] = [
  {
    id: "rm-barca",
    badge: { label: "LIVE NOW", variant: "live" },
    leagueLabel: "21:00",
    left: { name: "REAL MADRID", sport: "soccer" },
    right: { name: "BARCELONA", sport: "soccer" },
    metric: { label: "WIN PROBABILITY", valueLabel: "68%", value: 68, color: "lime" },
  },
  {
    id: "gsw-phx",
    badge: { label: "THU · 19:30", variant: "time" },
    leagueLabel: "NBA",
    left: { name: "GS WARRIORS", sport: "basketball" },
    right: { name: "PHX SUNS", sport: "basketball" },
    metric: { label: "MOMENTUM METER", valueLabel: "42%", value: 42, color: "orange" },
  },
  {
    id: "atp-social",
    badge: { label: "SOCIAL MATCH", variant: "social" },
    leagueLabel: "ATP",
    left: { name: "ALCARAZ", sport: "tennis" },
    right: { name: "DJOKOVIC", sport: "tennis" },
    metric: { label: "CONFIDENCE", valueLabel: "High", value: 85, color: "cyan" },
  },
];

export const mockLeaderboard: LeaderboardRow[] = [
  { position: 1, name: "Alex_Vortex", xp: 14200, accent: "lime" },
  { position: 2, name: "Sloane_Predicts", xp: 13850, accent: "dim" },
  { position: 3, name: "Kinetic Player", xp: 12900, isYou: true, accent: "cyan" },
];
