import { prisma } from "@/lib/prisma";
import { CompetitionPhaseType, KnockoutRound } from "@prisma/client";
import { formatSlot, worldCup2026VirtualR32 } from "@/lib/knockout/worldcup2026";
import type { MatchListItem } from "@/components/groups/matches/types";
import { MatchSection } from "@/components/groups/matches/MatchSection";

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

  // Virtual bracket placeholders: shown even before fixtures are imported.
  // We keep this season-agnostic for now; for WC2026 we show the known R32 structure.
  const virtualR32 = worldCup2026VirtualR32();

  const matchIds = matches.map((m) => m.id);

  const predictions = matchIds.length
    ? await prisma.prediction.findMany({
        where: { userId: viewerUserId, matchId: { in: matchIds } },
        select: { matchId: true, homeScore: true, awayScore: true, advancesTeamId: true, source: true, updatedAt: true },
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

        // Before fixtures are imported/resolved, we show placeholders.
        if (roundMatches.length === 0) {
          const showVirtual = r === "R32";

          return (
            <div key={r} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              <div className="text-white font-display text-lg font-black tracking-tight">{roundLabel(r)}</div>
              <div className="mt-1 text-sm text-white/50">
                {showVirtual
                  ? "Bracket placeholders (fixtures will auto-sync from TheSportsDB once available)."
                  : "Locked — waiting for previous round results / official fixtures."}
              </div>

              {showVirtual ? (
                <div className="mt-4 space-y-2">
                  {virtualR32.map((vm) => (
                    <div
                      key={vm.id}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="text-sm text-white/80 font-bold">
                        {formatSlot(vm.home)} <span className="text-white/40">vs</span> {formatSlot(vm.away)}
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        Predicting opens when the real fixture exists.
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        const items: MatchListItem[] = roundMatches.map((m) => {
          const p = predictionByMatchId.get(m.id);

          return {
            id: m.id,
            phaseType: "KNOCKOUT",
            phaseLabel: roundLabel(r),
            kickoffAt: m.kickoffAt.toISOString(),
            visibleAt: (m.visibleAt ?? m.kickoffAt).toISOString(),
            lockAt: (m.lockAt ?? m.kickoffAt).toISOString(),
            status: m.status === "FINISHED" ? "FINAL" : m.status === "LIVE" ? "LIVE" : "SCHEDULED",
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName ?? undefined },
            away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName ?? undefined },
            userPrediction: p
              ? {
                  status: "PREDICTED",
                  homeScore: p.homeScore,
                  awayScore: p.awayScore,
                  advancesTeamId: p.advancesTeamId,
                  source: p.source,
                  updatedAt: p.updatedAt.toISOString(),
                }
              : undefined,
            result:
              m.result && m.status === "FINISHED"
                ? { homeScore: m.result.homeScore, awayScore: m.result.awayScore }
                : undefined,
          };
        });

        return <MatchSection key={r} title={roundLabel(r)} matches={items} />;
      })}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/50 text-sm">
        Note: exact Round of 32 placement for the 8 best 3rd-place teams will resolve automatically after the group stage finishes.
      </div>
    </div>
  );
}
