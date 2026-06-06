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

  const where =
    phaseType === "GROUP_STAGE"
      ? {
          competitionSeasonId: group.competitionSeasonId,
          competitionGroupId: { not: null },
        }
      : phaseType === "KNOCKOUT"
        ? {
            competitionSeasonId: group.competitionSeasonId,
            OR: [{ knockoutRound: { not: null } }, { competitionPhase: { type: "KNOCKOUT" } }],
          }
        : {
            competitionSeasonId: group.competitionSeasonId,
            competitionGroupId: null,
          };

  const matches = await prisma.match.findMany({
    where,
    include: {
      homeTeam: true,
      awayTeam: true,
      competitionPhase: true,
      result: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  // Align "first round" unlock behavior with the Swipe page:
  // If there are NO matches currently open (visibleAt <= now < lockAt) and the season hasn't started yet,
  // unlock the opening bucket (first 72 hours from the earliest kickoff) by setting visibleAt=now.
  const now = new Date();
  const anyOpen = matches.some((m) => {
    if (m.status === "FINISHED" || m.status === "CANCELED") return false;
    const visibleAt = (m.visibleAt ?? m.kickoffAt).getTime();
    const lockAt = (m.lockAt ?? m.kickoffAt).getTime();
    return visibleAt <= now.getTime() && now.getTime() < lockAt;
  });

  const seasonStarted = Boolean(season?.startsAt && season.startsAt.getTime() <= now.getTime());

  let openingBucketEnd: Date | null = null;

  if (!anyOpen && !seasonStarted) {
    const first = matches
      .filter((m) => m.status !== "FINISHED" && m.status !== "CANCELED")
      .map((m) => m.kickoffAt)
      .filter((t) => t.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (first) {
      openingBucketEnd = new Date(first.getTime() + 72 * 60 * 60 * 1000);
    }
  }

  return matches.map((m) => {
    const kickoffAt = m.kickoffAt.toISOString();

    // World Cup (group stage): allow predicting all group-stage matches immediately.
    // Each match locks 3 hours before kickoff.
    const lockAtDate =
      phaseType === "GROUP_STAGE"
        ? new Date(m.kickoffAt.getTime() - 3 * 60 * 60 * 1000)
        : m.lockAt ?? m.kickoffAt;

    const inOpeningBucket =
      openingBucketEnd &&
      m.kickoffAt.getTime() > now.getTime() &&
      m.kickoffAt.getTime() <= openingBucketEnd.getTime() &&
      now.getTime() < lockAtDate.getTime();

    // IMPORTANT: don't use server "now" as visibleAt.
    // If the client clock is behind the server clock by a few seconds, the UI can appear
    // temporarily locked right after a revalidation/refresh (visibleAt in the "future").
    // Using epoch makes the match immediately eligible in the opening bucket.
    const visibleAtDate =
      phaseType === "GROUP_STAGE" ? new Date(0) : inOpeningBucket ? new Date(0) : m.visibleAt ?? m.kickoffAt;

    return {
      id: m.id,
      phaseType,
      phaseLabel: m.competitionPhase?.name ?? "Season",
      kickoffAt,
      lockAt: lockAtDate.toISOString(),
      visibleAt: visibleAtDate.toISOString(),
      status: mapDbStatus(m.status),
      home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName ?? undefined },
      away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName ?? undefined },
      competitionLabel: season ? `${season.competition.name} ${season.seasonLabel}` : undefined,
      result:
        m.result && m.status === "FINISHED"
          ? { homeScore: m.result.homeScore, awayScore: m.result.awayScore }
          : undefined,
    } satisfies MatchListItem;
  });
}
