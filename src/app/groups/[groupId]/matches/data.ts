import type { PhaseType, MatchListItem } from "@/components/groups/matches/types";
import { mockMatches } from "@/components/groups/matches/mock";
import { prisma } from "@/lib/prisma";

function mapDbStatus(status: string): MatchListItem["status"] {
  switch (status) {
    case "SCHEDULED":
      return "SCHEDULED";
    case "LIVE":
      return "LIVE";
    case "FINISHED":
      return "FINAL";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELED":
      return "CANCELED";
    default:
      return "SCHEDULED";
  }
}

// Data provider seam.
// If the group is tied to a canonical CompetitionSeason, read from DB.
// Otherwise fall back to mocks (until other sports are ingested).
export async function getMatchesForGroup({
  groupId,
  phaseType,
}: {
  groupId: string;
  phaseType: PhaseType;
}): Promise<MatchListItem[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { competitionSeasonId: true },
  });

  if (!group?.competitionSeasonId) return mockMatches(phaseType);

  const season = await prisma.competitionSeason.findUnique({
    where: { id: group.competitionSeasonId },
    include: { competition: true },
  });

  const matches = await prisma.match.findMany({
    where: { competitionSeasonId: group.competitionSeasonId },
    include: {
      homeTeam: true,
      awayTeam: true,
      competitionPhase: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  return matches.map((m) => {
    const kickoffAt = m.kickoffAt.toISOString();
    const lockAt = (m.lockAt ?? m.kickoffAt).toISOString();
    const visibleAt = (m.visibleAt ?? m.kickoffAt).toISOString();

    return {
      id: m.id,
      phaseType,
      phaseLabel: m.competitionPhase?.name ?? "Season",
      kickoffAt,
      lockAt,
      visibleAt,
      status: mapDbStatus(m.status),
      home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName ?? undefined },
      away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName ?? undefined },
      competitionLabel: season ? `${season.competition.name} ${season.seasonLabel}` : undefined,
    } satisfies MatchListItem;
  });
}
