import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";
import { Provider, Sport } from "@prisma/client";

import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";
import { importCompetitionSeasonFixtures } from "@/lib/importers/competition-season-fixtures";

const ImportSchema = z.object({
  sport: z.nativeEnum(Sport).default(Sport.SOCCER),
  provider: z.literal("THESPORTSDB").default("THESPORTSDB"),
  providerLeagueId: z.string().trim().min(1),
  seasonLabel: z.string().trim().min(1),
  providerSeasonId: z.string().trim().min(1).optional(),
  syncMatches: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = ImportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.sport !== Sport.SOCCER) {
    return NextResponse.json(
      { ok: false, error: "Only SOCCER is supported for provider-backed imports right now." },
      { status: 400 },
    );
  }

  const providerLeagueId = parsed.data.providerLeagueId;
  const seasonLabel = parsed.data.seasonLabel;
  const providerSeasonId = parsed.data.providerSeasonId;

  const client = new TheSportsDbClient();
  const league = await client.lookupLeague(providerLeagueId);

  if (!league) {
    return NextResponse.json(
      { ok: false, error: `Provider league not found: ${providerLeagueId}` },
      { status: 404 },
    );
  }

  const provider = Provider.THESPORTSDB;

  // Upsert canonical Competition.
  const competition = await prisma.competition.upsert({
    where: { provider_providerLeagueId: { provider, providerLeagueId } },
    create: {
      sport: Sport.SOCCER,
      name: league.strLeague,
      country: league.strCountry ?? null,
      published: false,
      provider,
      providerLeagueId,
    },
    update: {
      // Keep canonical values fresh without surprising admins.
      name: league.strLeague,
      country: league.strCountry ?? null,
      provider,
      providerLeagueId,
    },
    select: { id: true, name: true },
  });

  // Upsert canonical CompetitionSeason.
  const season = await (async () => {
    if (providerSeasonId) {
      return prisma.competitionSeason.upsert({
        where: { provider_providerSeasonId: { provider, providerSeasonId } },
        create: {
          competitionId: competition.id,
          seasonLabel,
          published: false,
          archivedAt: null,
          provider,
          providerSeasonId,
        },
        update: {
          competitionId: competition.id,
          seasonLabel,
          archivedAt: null,
        },
        select: { id: true, seasonLabel: true },
      });
    }

    // Fallback uniqueness (competitionId+seasonLabel)
    return prisma.competitionSeason.upsert({
      where: { competitionId_seasonLabel: { competitionId: competition.id, seasonLabel } },
      create: {
        competitionId: competition.id,
        seasonLabel,
        published: false,
        archivedAt: null,
        provider,
      },
      update: {
        archivedAt: null,
        provider,
      },
      select: { id: true, seasonLabel: true },
    });
  })();

  let fixturesResult: unknown = null;

  if (parsed.data.syncMatches) {
    try {
      fixturesResult = await importCompetitionSeasonFixtures({ competitionSeasonId: season.id });
      await prisma.competitionSeason.update({
        where: { id: season.id },
        data: {
          fixturesSyncedAt: new Date(),
          fixturesSyncError: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.competitionSeason.update({
        where: { id: season.id },
        data: {
          fixturesSyncedAt: null,
          fixturesSyncError: msg.slice(0, 800),
        },
      });

      // Still return the imported season, but mark sync as failed.
      fixturesResult = { ok: false, error: msg };
    }
  }

  revalidateTag("admin:catalog", "default");

  return NextResponse.json({
    ok: true,
    competition,
    season,
    fixtures: fixturesResult,
  });
}
