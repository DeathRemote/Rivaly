import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type SwipeMatch = {
  matchId: string;
  competitionSeasonId: string;
  kickoffAt: string;
  lockAt: string;
  competitionLabel: string;
  home: { name: string; shortName?: string | null };
  away: { name: string; shortName?: string | null };
  groupId: string;
};

export async function registerSwipeRoutes(app: FastifyInstance) {
  app.get("/api/internal/swipe-matches", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const query = z
        .object({
          limit: z.coerce.number().int().positive().max(200).optional().default(80),
        })
        .parse(req.query);

      const matches = await getSwipeMatchesForUser(userId, query.limit);
      return { matches };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}

async function getSwipeMatchesForUser(userId: string, limit: number): Promise<SwipeMatch[]> {
  const now = new Date();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, competitionSeasonId: true },
  });

  const seasonIds = Array.from(new Set(groups.map((g) => g.competitionSeasonId).filter(Boolean) as string[]));
  if (seasonIds.length === 0) return [];

  const groupIdsBySeason = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.competitionSeasonId) continue;
    const arr = groupIdsBySeason.get(g.competitionSeasonId) ?? [];
    arr.push(g.id);
    groupIdsBySeason.set(g.competitionSeasonId, arr);
  }

  async function excludeAlreadyPredicted<T extends { id: string }>(items: T[]) {
    if (items.length === 0) return [] as T[];

    const existing = await prisma.prediction.findMany({
      where: { userId, matchId: { in: items.map((m) => m.id) } },
      select: { matchId: true },
    });

    const predicted = new Set(existing.map((p) => p.matchId));
    return items.filter((m) => !predicted.has(m.id));
  }

  const standardOpen = await prisma.match.findMany({
    where: {
      competitionSeasonId: { in: seasonIds },
      status: { in: ["SCHEDULED", "LIVE", "UNKNOWN"] },
      visibleAt: { lte: now },
      lockAt: { gt: now },
    },
    select: {
      id: true,
      kickoffAt: true,
      lockAt: true,
      competitionSeasonId: true,
      competitionSeason: { select: { seasonLabel: true, competition: { select: { name: true } } } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
    },
    orderBy: { kickoffAt: "asc" },
    take: limit,
  });

  let matches = await excludeAlreadyPredicted(standardOpen);

  if (matches.length === 0) {
    const upcoming = await prisma.match.findMany({
      where: {
        competitionSeasonId: { in: seasonIds },
        status: { in: ["SCHEDULED", "LIVE", "UNKNOWN"] },
        kickoffAt: { gt: now },
      },
      select: {
        id: true,
        kickoffAt: true,
        lockAt: true,
        competitionSeasonId: true,
        competitionSeason: {
          select: {
            seasonLabel: true,
            startsAt: true,
            competition: { select: { name: true } },
          },
        },
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
      orderBy: [{ competitionSeasonId: "asc" }, { kickoffAt: "asc" }],
      take: Math.max(250, limit * 3),
    });

    const firstKickoffBySeason = new Map<string, Date>();
    for (const m of upcoming) {
      if (!firstKickoffBySeason.has(m.competitionSeasonId)) {
        firstKickoffBySeason.set(m.competitionSeasonId, m.kickoffAt);
      }
    }

    const bucketMs = 72 * 60 * 60 * 1000;

    const bucket = upcoming.filter((m) => {
      const seasonStart = m.competitionSeason.startsAt;
      if (seasonStart && seasonStart.getTime() <= now.getTime()) return false;

      const first = firstKickoffBySeason.get(m.competitionSeasonId);
      if (!first) return false;

      return m.kickoffAt.getTime() <= first.getTime() + bucketMs;
    });

    matches = await excludeAlreadyPredicted(bucket);
  }

  if (matches.length === 0) return [];

  const out: SwipeMatch[] = [];

  for (const m of matches) {
    const seasonGroupIds = groupIdsBySeason.get(m.competitionSeasonId) ?? [];
    const groupId = seasonGroupIds[0];
    if (!groupId) continue;

    const competitionLabel = `${m.competitionSeason.competition.name} ${m.competitionSeason.seasonLabel}`;

    out.push({
      matchId: m.id,
      competitionSeasonId: m.competitionSeasonId,
      kickoffAt: m.kickoffAt.toISOString(),
      lockAt: (m.lockAt ?? m.kickoffAt).toISOString(),
      competitionLabel,
      home: { name: m.homeTeam.name, shortName: m.homeTeam.shortName },
      away: { name: m.awayTeam.name, shortName: m.awayTeam.shortName },
      groupId,
    });
  }

  return out;
}
