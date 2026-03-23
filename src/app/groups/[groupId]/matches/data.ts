import type { PhaseType } from "@/components/groups/matches/types";
import { mockMatches } from "@/components/groups/matches/mock";

// Data provider seam.
// Today: mocked matches.
// Next: fetch real matches for the group's associated competition/season/phase.
export function getMatchesForGroup({
  phaseType,
}: {
  phaseType: PhaseType;
}) {
  return mockMatches(phaseType);
}
