import { prisma } from "@/lib/prisma";
import { CompetitionPhaseType, KnockoutRound } from "@prisma/client";

function roundLabel(r: KnockoutRound) {
  switch (r) {
    case "R32":
      return "Round of 32";
    case "R16":
      return "Round of 16";
    case "QF":
      return "Quarter-finals";
    case "SF":
      return "Semi-finals";
    case "FINAL":
      return "Final";
    case "THIRD_PLACE":
      return "Third-place";
    default:
      return r;
  }
}

const ORDERED_ROUNDS: KnockoutRound[] = ["R32", "R16", "QF", "SF", "FINAL"];

export async function GroupKnockoutTab({
  competitionSeasonId,
  viewerUserId,
}: {
  competitionSeasonId: string;
  viewerUserId: string;
}) {
  if (!competitionSeasonId) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        Knockout stage isn’t available for this group.
      </div>
    );
  }

  const season = await prisma.competitionSeason.findUnique({
    where: { id: competitionSeasonId },
    select: {
      id: true,
      seasonLabel: true,
      competition: { select: { name: true } },
      phases: { select: { type: true } },
    },
  });

  const hasKnockout = Boolean(season?.phases.some((p) => p.type === CompetitionPhaseType.KNOCKOUT));

  // If the season doesn't have a knockout phase, still keep the tab visible but show a friendly empty state.
  if (!hasKnockout) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        No knockout stage for this season.
      </div>
    );
  }

  const matches = await prisma.match.findMany({
    where: {
      competitionSeasonId,
      OR: [
        { knockoutRound: { not: null } },
        { competitionPhase: { is: { type: CompetitionPhaseType.KNOCKOUT } } },
      ],
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      result: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  const matchIds = matches.map((m) => m.id);

  const predictions = matchIds.length
    ? await prisma.prediction.findMany({
        where: { userId: viewerUserId, matchId: { in: matchIds } },
        select: { matchId: true, homeScore: true, awayScore: true, advancesTeamId: true },
      })
    : [];

  const predictionByMatchId = new Map(predictions.map((p) => [p.matchId, p] as const));

  const matchesByRound = new Map<KnockoutRound, typeof matches>();
  for (const m of matches) {
    const r = m.knockoutRound ?? null;
    if (!r) continue;
    if (!matchesByRound.has(r)) matchesByRound.set(r, []);
    matchesByRound.get(r)!.push(m);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-white font-display text-xl font-black tracking-tight">Knockout stage</div>
        <div className="mt-1 text-white/50 text-sm">
          Predict each round as it unlocks. If you predict a draw, you’ll also pick who advances.
        </div>
      </div>

      {ORDERED_ROUNDS.map((r) => {
        const roundMatches = matchesByRound.get(r) ?? [];

        // Before fixtures are imported/resolved, we show the round but keep it locked.
        if (roundMatches.length === 0) {
          return (
            <div key={r} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              <div className="text-white font-display text-lg font-black tracking-tight">{roundLabel(r)}</div>
              <div className="mt-1 text-sm text-white/50">
                Waiting for official fixtures… (will auto-sync from TheSportsDB)
              </div>
            </div>
          );
        }

        return (
          <div key={r} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-white font-display text-lg font-black tracking-tight">{roundLabel(r)}</div>

            <div className="mt-4 space-y-3">
              {roundMatches.map((m) => {
                const p = predictionByMatchId.get(m.id);

                const advancesName = p?.advancesTeamId
                  ? p.advancesTeamId === m.homeTeamId
                    ? m.homeTeam.name
                    : p.advancesTeamId === m.awayTeamId
                      ? m.awayTeam.name
                      : "(unknown)"
                  : null;

                const hasResult = m.status === "FINISHED" && m.result;

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-white font-bold">
                        {m.homeTeam.name} <span className="text-white/40">vs</span> {m.awayTeam.name}
                      </div>
                      <div className="text-xs text-white/50">
                        {new Date(m.kickoffAt).toLocaleString()}
                      </div>
                    </div>

                    {hasResult ? (
                      <div className="mt-2 text-sm text-white/70">
                        Result: {m.result!.homeScore}–{m.result!.awayScore}
                      </div>
                    ) : null}

                    <div className="mt-2 text-sm">
                      {p ? (
                        <div className="text-white/80">
                          Your pick: {p.homeScore}–{p.awayScore}
                          {p.homeScore === p.awayScore && advancesName ? (
                            <span className="text-white/50"> · Advances: {advancesName}</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-white/40">Not predicted yet</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/50 text-sm">
        Early bracket placeholders (e.g. “Winner Group A”) will appear here once we add the virtual bracket view.
      </div>
    </div>
  );
}
