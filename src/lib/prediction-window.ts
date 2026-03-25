import { prisma } from "@/lib/prisma";

export function inStandardKickoffWindow(match: {
  kickoffAt: Date;
  visibleAt: Date | null;
  lockAt: Date | null;
}): boolean {
  const now = Date.now();
  const visibleAt = match.visibleAt?.getTime() ?? match.kickoffAt.getTime();
  const lockAt = match.lockAt?.getTime() ?? match.kickoffAt.getTime();

  return visibleAt <= now && now < lockAt;
}

export async function inSeasonOpeningWindow(opts: {
  competitionSeasonId: string;
  matchId: string;
  bucketHours?: number;
}): Promise<boolean> {
  const bucketHours = opts.bucketHours ?? 72;
  const now = new Date();

  const [season, firstMatch, anyFinished] = await Promise.all([
    prisma.competitionSeason.findUnique({
      where: { id: opts.competitionSeasonId },
      select: { startsAt: true },
    }),
    prisma.match.findFirst({
      where: {
        competitionSeasonId: opts.competitionSeasonId,
        status: { notIn: ["FINISHED", "CANCELED"] },
      },
      orderBy: { kickoffAt: "asc" },
      select: { id: true, kickoffAt: true },
    }),
    prisma.match.findFirst({
      where: {
        competitionSeasonId: opts.competitionSeasonId,
        status: "FINISHED",
      },
      select: { id: true },
    }),
  ]);

  if (!firstMatch) return false;

  // Season is considered "started" if startsAt is in the past OR there is a finished match.
  const started = Boolean(
    (season?.startsAt && season.startsAt.getTime() <= now.getTime()) || anyFinished,
  );

  if (started) return false;

  // Only allow the "opening bucket" (first weekend / first round)
  const end = new Date(firstMatch.kickoffAt.getTime() + bucketHours * 60 * 60 * 1000);

  // Match must be in the first bucket and still before lock.
  const target = await prisma.match.findUnique({
    where: { id: opts.matchId },
    select: { kickoffAt: true, lockAt: true, status: true },
  });

  if (!target) return false;
  if (target.status === "FINISHED" || target.status === "CANCELED" || target.status === "POSTPONED") {
    return false;
  }

  const lockAt = target.lockAt ?? target.kickoffAt;

  return (
    target.kickoffAt.getTime() >= now.getTime() &&
    target.kickoffAt.getTime() <= end.getTime() &&
    now.getTime() < lockAt.getTime()
  );
}
