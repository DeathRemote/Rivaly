import { prisma } from "@/lib/prisma";
import { CompetitionPhaseType, KnockoutRound, Provider } from "@prisma/client";

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

  // Phase/stage detection: if TheSportsDB provides strGroup or special rounds, we model
  // a Group Stage + Knockout. Otherwise default to a single League phase.
  // Note: this is best-effort based on what the API returns.
  const ensurePhase = async (name: string, order: number, type: CompetitionPhaseType) =>
    prisma.competitionPhase.upsert({
      where: {
        competitionSeasonId_name: {
          competitionSeasonId: season.id,
          name,
        },
      },
      create: {
        competitionSeasonId: season.id,
        name,
        order,
        type,
      },
      update: { type, order },
    });

  // Prefer season-wide endpoint first (single request).
  // With premium keys, this should return the full season and avoids many round requests.
  const eventsById = new Map<
    string,
    Awaited<ReturnType<typeof client.listEventsForLeagueSeason>>[number]
  >();

  const seasonEvents = await client.listEventsForLeagueSeason(leagueId, seasonLabel);
  for (const e of seasonEvents) eventsById.set(e.idEvent, e);

  // If it looks truncated, attempt round-walk as a best-effort fallback.
  // Some keys/endpoints may return 404 for eventsround; in that case we keep seasonEvents.
  if (eventsById.size < 100) {
    for (let round = 1; round <= 60; round++) {
      let roundEvents: Awaited<ReturnType<typeof client.listEventsForLeagueSeasonRound>> = [];

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          roundEvents = await client.listEventsForLeagueSeasonRound(leagueId, seasonLabel, round);
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);

          // If the endpoint itself is missing/blocked (404), don't fail the whole import.
          if (msg.includes(" 404 ") || msg.includes("404 Not Found")) {
            roundEvents = [];
            break;
          }

          if (attempt === 3) {
            throw new Error(
              `[fixtures] eventsround failed at round=${round} after ${attempt} attempts: ${msg}`,
            );
          }

          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }

      // If round endpoint is unavailable (404), we stop trying rounds.
      if (round === 1 && roundEvents.length === 0 && eventsById.size > 0) break;

      if (!roundEvents.length) break;
      for (const e of roundEvents) eventsById.set(e.idEvent, e);

      await new Promise((r) => setTimeout(r, 150));
    }
  }

  const events = [...eventsById.values()];

  const hasGroupsFromProvider = events.some((e) => Boolean(e.strGroup && String(e.strGroup).trim().length > 0));
  const hasKnockoutHints = events.some((e) => {
    const r = e.intRound ?? null;
    const name = (e.strEvent ?? "").toLowerCase();
    const groupKey = (e.strGroup ?? "").trim();

    // If TheSportsDB gives a group key, treat it as group-stage (avoid false positives).
    if (groupKey) return false;

    // Classic TheSportsDB special rounds.
    if (r != null && r >= 125) return true;

    // Numeric bracket rounds seen in some competitions/providers.
    if (r === 64 || r === 32 || r === 16 || r === 8 || r === 4 || r === 2) return true;

    // Name-based hint.
    if (name.includes("final")) return true;
    if (name.includes("round of 32") || name.includes("round of 16") || name.includes("quarter") || name.includes("semi")) return true;

    return false;
  });

  // If this season already has CompetitionGroups in DB, do NOT regress to league-mode even if the provider
  // season endpoint omits strGroup (TheSportsDB can be inconsistent between endpoints/keys).
  const existingGroupsCount = await prisma.competitionGroup.count({
    where: { competitionPhase: { competitionSeasonId: season.id } },
  });

  const hasGroups = hasGroupsFromProvider || existingGroupsCount > 0;

  const leaguePhase = !hasGroups ? await ensurePhase("Regular Season", 1, CompetitionPhaseType.LEAGUE) : null;
  const groupPhase = hasGroups ? await ensurePhase("Group Stage", 1, CompetitionPhaseType.GROUP_STAGE) : null;
  const knockoutPhase = hasKnockoutHints ? await ensurePhase("Knockout", 2, CompetitionPhaseType.KNOCKOUT) : null;

  function normalizeGroupKey(input: string | null | undefined): string | null {
    const raw = (input ?? "").trim();
    if (!raw) return null;

    // Prefer extracting the canonical letter when provider includes variants like:
    // - "Group A" / "Group A - Matchday 1" / "Grp A"
    const m = raw.match(/\b(?:group|grp)\b\s*([A-H])\b/i);
    if (m?.[1]) return m[1].toUpperCase();

    // Fallback: keep the provider label so group creation + match assignment remain consistent.
    return raw.toUpperCase();
  }

  // Create groups for group-stage events.
  const groupIdByKey = new Map<string, string>();
  if (groupPhase && hasGroups) {
    const rawKeys = Array.from(
      new Set(
        events
          .map((e) => normalizeGroupKey(e.strGroup))
          .filter((s): s is string => Boolean(s && s.trim().length > 0)),
      ),
    ).sort();

    for (const [idx, key] of rawKeys.entries()) {
      const g = await prisma.competitionGroup.upsert({
        where: {
          competitionPhaseId_key: {
            competitionPhaseId: groupPhase.id,
            key,
          },
        },
        create: {
          competitionPhaseId: groupPhase.id,
          key,
          name: key.length === 1 ? `Group ${key}` : key,
          order: idx + 1,
        },
        update: {
          name: key.length === 1 ? `Group ${key}` : key,
          order: idx + 1,
        },
        select: { id: true, key: true },
      });
      groupIdByKey.set(g.key, g.id);
      // Also index by normalized key to survive older imports that stored verbose keys.
      const normalized = normalizeGroupKey(g.key);
      if (normalized) groupIdByKey.set(normalized, g.id);
    }

    // TheSportsDB can omit `strGroup` on some endpoints/keys.
    // If we already have groups in DB but couldn't derive keys from the provider payload,
    // load the existing groups so we can still assign `competitionGroupId` to matches.
    if (groupIdByKey.size === 0) {
      const existingGroups = await prisma.competitionGroup.findMany({
        where: { competitionPhaseId: groupPhase.id },
        select: { id: true, key: true },
      });
      for (const g of existingGroups) {
        groupIdByKey.set(g.key, g.id);
        const normalized = normalizeGroupKey(g.key);
        if (normalized) groupIdByKey.set(normalized, g.id);
      }
    }
  }

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

    const existingMatch = await prisma.match.findUnique({
      where: {
        provider_providerMatchId: {
          provider: mapped.provider,
          providerMatchId: mapped.providerMatchId,
        },
      },
      select: { id: true, providerGroupKey: true, competitionGroupId: true },
    });

    const effectiveProviderGroupKey =
      mapped.providerGroupKey ?? existingMatch?.providerGroupKey ?? null;

    const isGroupStageMatch = Boolean(groupPhase && effectiveProviderGroupKey);
    const isKnockoutMatch = Boolean(
      knockoutPhase && (mapped.knockoutRound || (mapped.providerRound ?? 0) >= 125),
    );

    // Prediction policy:
    // - Group stage (World Cup): open immediately, lock 3h before kickoff.
    // - Everything else: open 7 days before kickoff, lock 3h before kickoff.
    const visibleAt = isGroupStageMatch
      ? new Date(0)
      : new Date(mapped.kickoffAt.getTime() - 7 * 24 * 60 * 60 * 1000);

    const lockAt = new Date(mapped.kickoffAt.getTime() - 3 * 60 * 60 * 1000);

    if (opts.dryRun) continue;

    const phaseId = isGroupStageMatch
      ? groupPhase!.id
      : isKnockoutMatch
        ? knockoutPhase?.id ?? null
        : leaguePhase?.id ?? groupPhase?.id ?? null;

    // Some provider payloads omit `strGroup`, but the event name often includes it.
    const inferredGroupKeyFromEventName = normalizeGroupKey(e.strEvent ?? null);

    const normalizedGroupKey = normalizeGroupKey(effectiveProviderGroupKey) ?? inferredGroupKeyFromEventName;

    const competitionGroupId =
      normalizedGroupKey && groupIdByKey.has(normalizedGroupKey) ? groupIdByKey.get(normalizedGroupKey)! : null;

    if (!existingMatch) {
      await prisma.match.create({
        data: {
          competitionSeasonId: season.id,
          competitionPhaseId: phaseId,
          competitionGroupId,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt: mapped.kickoffAt,
          status: mapped.status,
          provider: mapped.provider,
          providerMatchId: mapped.providerMatchId,
          providerRound: mapped.providerRound ?? undefined,
          providerGroupKey: effectiveProviderGroupKey ?? undefined,
          knockoutRound: mapped.knockoutRound ? (mapped.knockoutRound as KnockoutRound) : undefined,
          visibleAt,
          lockAt,
        },
      });
      created++;
    } else {
      await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          competitionSeasonId: season.id,
          competitionPhaseId: phaseId,
          competitionGroupId,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt: mapped.kickoffAt,
          status: mapped.status,
          providerRound: mapped.providerRound ?? undefined,
          providerGroupKey: effectiveProviderGroupKey ?? undefined,
          knockoutRound: mapped.knockoutRound ? (mapped.knockoutRound as KnockoutRound) : undefined,
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
