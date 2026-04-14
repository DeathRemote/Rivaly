import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type GroupLeaderboardRow = {
  userId: string;
  rank: number;
  name: string;
  points: number;
  accuracyPct: number;
  trend: "up" | "down" | "flat";
  isYou: boolean;
};

export async function registerGroupLeaderboardRoutes(app: FastifyInstance) {
  app.get("/api/internal/groups/:groupId/leaderboard", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const params = z.object({ groupId: z.string().min(1) }).parse(req.params);
      const query = z
        .object({
          limit: z.coerce.number().int().positive().max(50).optional().default(10),
          cursorPoints: z.coerce.number().int().optional(),
          cursorUserId: z.string().optional(),
        })
        .parse(req.query);

      // membership check
      const member = await prisma.groupMember.findFirst({
        where: { groupId: params.groupId, userId },
        select: { id: true },
      });
      if (!member) return reply.code(403).send({ error: "Forbidden" });

      const rows = await prisma.$queryRaw<
        Array<{
          userId: string;
          points: number;
          rank: number;
          name: string | null;
          username: string | null;
          totalCount: number;
          scoredTotal: number | null;
          correctTotal: number | null;
          last7d: number | null;
          prev7d: number | null;
        }>
      >`
        WITH ranked AS (
          SELECT
            gm."userId" AS "userId",
            gm."points" AS "points",
            DENSE_RANK() OVER (ORDER BY gm."points" DESC)::int AS "rank",
            COUNT(*) OVER ()::int AS "totalCount",
            u."name" AS "name",
            u."username" AS "username",
            acc."scoredTotal" AS "scoredTotal",
            acc."correctTotal" AS "correctTotal",
            acc."last7d" AS "last7d",
            acc."prev7d" AS "prev7d"
          FROM "GroupMember" gm
          INNER JOIN "User" u ON u."id" = gm."userId"
          LEFT JOIN "GroupMemberAccuracyAggregate" acc
            ON acc."groupId" = gm."groupId" AND acc."userId" = gm."userId"
          WHERE gm."groupId" = ${params.groupId}
        )
        SELECT *
        FROM ranked
        WHERE (
          ${query.cursorPoints == null} OR
          ("points" < ${query.cursorPoints ?? 0}) OR
          ("points" = ${query.cursorPoints ?? 0} AND "userId" > ${query.cursorUserId ?? ""})
        )
        ORDER BY "points" DESC, "userId" ASC
        LIMIT ${query.limit + 1};
      `;

      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit);

      const out: GroupLeaderboardRow[] = page.map((r) => {
        const scored = r.scoredTotal ?? 0;
        const correct = r.correctTotal ?? 0;
        const accuracyPct = scored > 0 ? Math.round((correct / scored) * 100) : 0;

        const last7d = r.last7d ?? 0;
        const prev7d = r.prev7d ?? 0;
        const trend: "up" | "down" | "flat" = last7d === prev7d ? "flat" : last7d > prev7d ? "up" : "down";

        return {
          userId: r.userId,
          rank: r.rank,
          name: r.username ?? r.name ?? "Unknown",
          points: r.points,
          accuracyPct,
          trend,
          isYou: r.userId === userId,
        };
      });

      const nextCursor = hasMore
        ? {
            cursorPoints: page[page.length - 1]!.points,
            cursorUserId: page[page.length - 1]!.userId,
          }
        : null;

      const totalCount = page[0]?.totalCount ?? 0;

      return { rows: out, nextCursor, totalCount };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}
