import { prisma } from "@/lib/prisma";
import { Provider } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { mapTheSportsDbEventToDomain } from "@/lib/importers/thesportsdb/map";

export async function importCompetitionSeasonFixtures(opts: {
  competitionSeasonId: string;
  provider?: Provider; // defaults to season.provider
  dryRun?: boolean;
}) {
  const season = await prisma.competitionSeason.findUnique({
    where: { id: opts.competitionSeasonId },
    include: { competition: true },
  });

  if (!season) throw new Error("CompetitionSeason not found");

  const provider = opts.provider ?? season.provider;
  if (provider !== Provider.THESPORTSDB) {
    throw new Error(`Unsupported provider for fixture import: ${provider ?? "<null>"}`);
  }

  const leagueId = season.competition.providerLeagueId;
  if (!leagueId) throw new Error("Missing competition.providerLeagueId (TheSportsDB league id)");

  const seasonLabel = season.seasonLabel;

  const client = new TheSportsDbClient();

  // Ensure providerSeasonId is stored when discoverable.
  const seasons = await client.listSeasonsForLeague(leagueId);
  const providerSeasonId = seasons.find((s) => s.strSeason === seasonLabel)?.idSeason ?? null;

  if (providerSeasonId && season.providerSeasonId !== providerSeasonId) {
    if (!opts.dryRun) {
      await prisma.competitionSeason.update({
        where: { id: season.id },
        data: { provider: Provider.THESPORTSDB, providerSeasonId },
      });
    }
  }

  // For now: single phase.
  const phase = await prisma.competitionPhase.upsert({
    where: {
      competitionSeasonId_name: {
        competitionSeasonId: season.id,
        name: "Regular Season",
      },
    },
    create: {
      competitionSeasonId: season.id,
      name: "Regular Season",
      order: 1,
    },
    update: {},
  });

  // NOTE: `eventsseason.php` can be incomplete/limited depending on league + API plan.
  // To ensure we ingest the whole season, we fetch round-by-round and stop when empty.
  const eventsById = new Map<string, Awaited<ReturnType<typeof client.listEventsForLeagueSeason>>[number]>();

  for (let round = 1; round <= 60; round++) {
    // TheSportsDB test key can rate-limit / return HTML. We retry a few times and stop gracefully.
    let roundEvents: Awaited<ReturnType<typeof client.listEventsForLeagueSeasonRound>> = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        roundEvents = await client.listEventsForLeagueSeasonRound(leagueId, seasonLabel, round);
        break;
      } catch (err) {
        if (attempt === 3) {
          throw new Error(
            `[fixtures] eventsround failed at round=${round} after ${attempt} attempts: ` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }

    if (!roundEvents.length) break;

    for (const e of roundEvents) eventsById.set(e.idEvent, e);

    // Small throttle to reduce rate-limit issues with free keys.
    await new Promise((r) => setTimeout(r, 150));
  }

  // Fallback: if round fetching yielded nothing (some leagues don't support rounds), try season endpoint.
  if (eventsById.size === 0) {
    const seasonEvents = await client.listEventsForLeagueSeason(leagueId, seasonLabel);
    for (const e of seasonEvents) eventsById.set(e.idEvent, e);
  }

  const events = [...eventsById.values()];

  let created = 0;
  let updated = 0;

  for (const e of events) {
    const mapped = mapTheSportsDbEventToDomain(e);

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.upsert({
        where: {
          provider_providerTeamId: {
            provider: mapped.homeTeam.provider,
            providerTeamId: mapped.homeTeam.providerTeamId,
          },
        },
        create: {
          provider: mapped.homeTeam.provider,
          providerTeamId: mapped.homeTeam.providerTeamId,
          name: mapped.homeTeam.name,
        },
        update: { name: mapped.homeTeam.name },
      }),
      prisma.team.upsert({
        where: {
          provider_providerTeamId: {
            provider: mapped.awayTeam.provider,
            providerTeamId: mapped.awayTeam.providerTeamId,
          },
        },
        create: {
          provider: mapped.awayTeam.provider,
          providerTeamId: mapped.awayTeam.providerTeamId,
          name: mapped.awayTeam.name,
        },
        update: { name: mapped.awayTeam.name },
      }),
    ]);

    // Default prediction policy placeholders (can be overridden later)
    // Kickoff window: last 7 days before kickoff.
    const visibleAt = new Date(mapped.kickoffAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lockAt = mapped.kickoffAt;

    const existing = await prisma.match.findUnique({
      where: {
        provider_providerMatchId: {
          provider: mapped.provider,
          providerMatchId: mapped.providerMatchId,
        },
      },
      select: { id: true },
    });

    if (opts.dryRun) continue;

    if (!existing) {
      await prisma.match.create({
        data: {
          competitionSeasonId: season.id,
          competitionPhaseId: phase.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt: mapped.kickoffAt,
          status: mapped.status,
          provider: mapped.provider,
          providerMatchId: mapped.providerMatchId,
          visibleAt,
          lockAt,
        },
      });
      created++;
    } else {
      await prisma.match.update({
        where: { id: existing.id },
        data: {
          competitionSeasonId: season.id,
          competitionPhaseId: phase.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt: mapped.kickoffAt,
          status: mapped.status,
          visibleAt,
          lockAt,
        },
      });
      updated++;
    }
  }

  return {
    provider,
    leagueId,
    seasonLabel,
    totalEvents: events.length,
    created,
    updated,
  };
}
