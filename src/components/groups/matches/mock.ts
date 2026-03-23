import type { MatchListItem, PhaseType } from "@/components/groups/matches/types";

function isoPlus(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function phaseLabel(phaseType: PhaseType) {
  if (phaseType === "GROUP_STAGE") return "Group A";
  if (phaseType === "KNOCKOUT") return "Quarterfinal";
  return "Gameweek 12";
}

export function mockMatches(phaseType: PhaseType): MatchListItem[] {
  return [
    {
      id: "m1",
      phaseType,
      phaseLabel: phaseLabel(phaseType),
      kickoffAt: isoPlus(30),
      visibleAt: isoPlus(-24),
      lockAt: isoPlus(27),
      status: "SCHEDULED",
      home: { name: "Arsenal FC" },
      away: { name: "FC Porto" },
      competitionLabel: "Champions League",
      userPrediction: { status: "NOT_PREDICTED" },
    },
    {
      id: "m2",
      phaseType,
      phaseLabel: phaseLabel(phaseType),
      kickoffAt: isoPlus(12),
      visibleAt: isoPlus(-24),
      lockAt: isoPlus(9),
      status: "SCHEDULED",
      home: { name: "Real Madrid" },
      away: { name: "Barcelona" },
      competitionLabel: "Champions League",
      userPrediction: { status: "PREDICTED", summary: "Home win", updatedAt: isoPlus(-2) },
    },
    {
      id: "m3",
      phaseType,
      phaseLabel: phaseLabel(phaseType),
      kickoffAt: isoPlus(1),
      visibleAt: isoPlus(-48),
      lockAt: isoPlus(-2),
      status: "SCHEDULED",
      home: { name: "Liverpool" },
      away: { name: "PSG" },
      competitionLabel: "Champions League",
      userPrediction: { status: "LOCKED", summary: "2-1" },
    },
    {
      id: "m4",
      phaseType,
      phaseLabel: phaseLabel(phaseType),
      kickoffAt: isoPlus(-26),
      visibleAt: isoPlus(-80),
      lockAt: isoPlus(-29),
      status: "FINAL",
      home: { name: "Bayern" },
      away: { name: "Dortmund" },
      competitionLabel: "Champions League",
      userPrediction: { status: "COMPLETED", summary: "Away win" },
      result: { homeScore: 1, awayScore: 2 },
    },
  ];
}
