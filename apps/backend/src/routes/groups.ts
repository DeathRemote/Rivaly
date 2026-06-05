import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { Prisma } from "@prisma/client";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type GroupCardData = {
  id: string;
  name: string;
  competition: string;
  memberCount: number;
  yourRank: number | null;
  yourPoints: number;
  top3: Array<{ position: number; name: string; points: number; isYou?: boolean }>;
};

export async function registerGroupRoutes(app: FastifyInstance) {
  // Groups list for dashboard UI (my/public).
  app.get("/api/internal/groups", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const query = z
        .object({
          tab: z.enum(["my", "public"]).optional().default("my"),
          take: z.coerce.number().int().positive().max(50).optional().default(24),
        })
        .parse(req.query);

      if (query.tab === "public") {
        // 1) Ensure the user is a member of any official public group for seasons they participate in.
        const seasons = await prisma.group.findMany({
          where: { members: { some: { userId } }, competitionSeasonId: { not: null } },
          distinct: ["competitionSeasonId"],
          select: { competitionSeasonId: true },
        });

        const seasonIds = seasons.map((s) => s.competitionSeasonId).filter(Boolean) as string[];

        const official =
          seasonIds.length === 0
            ? []
            : await prisma.officialPublicGroup.findMany({
                where: { competitionSeasonId: { in: seasonIds } },
                select: { groupId: true },
              });

        for (const o of official) {
          await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: o.groupId, userId } },
            create: { groupId: o.groupId, userId, role: "MEMBER", points: 0 },
            update: {},
            select: { id: true },
          });
        }

        // 2) Your public groups (ranked)
        const yourPublicMemberships = await prisma.groupMember.findMany({
          where: { userId, group: { visibility: "PUBLIC" } },
          select: {
            groupId: true,
            points: true,
            group: {
              select: {
                id: true,
                name: true,
                competition: true,
                visibility: true,
                isJoinable: true,
                _count: { select: { members: true } },
                members: {
                  orderBy: { points: "desc" },
                  take: 3,
                  select: { userId: true, points: true, user: { select: { name: true, username: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: query.take,
        });

        const yourPublicGroupIds = yourPublicMemberships.map((m) => m.groupId);

        const yourRanks =
          yourPublicGroupIds.length === 0
            ? []
            : await prisma.$queryRaw<Array<{ groupId: string; rank: number }>>`
              SELECT "groupId", "rank" FROM (
                SELECT
                  "groupId",
                  "userId",
                  DENSE_RANK() OVER (PARTITION BY "groupId" ORDER BY "points" DESC)::int AS "rank"
                FROM "GroupMember"
                WHERE "groupId" IN (${Prisma.join(yourPublicGroupIds)})
              ) t
              WHERE "userId" = ${userId}
            `;

        const rankByGroupId = new Map(yourRanks.map((r) => [r.groupId, r.rank] as const));

        const yourPublicGroups: any[] = yourPublicMemberships.map((m) => {
          const top3 = m.group.members.map((row, idx) => ({
            position: idx + 1,
            name: row.user.username ?? row.user.name ?? "Unknown",
            points: row.points,
            isYou: row.userId === userId,
          }));

          return {
            id: m.group.id,
            name: m.group.name,
            competition: m.group.competition,
            memberCount: m.group._count.members,
            yourRank: rankByGroupId.get(m.groupId) ?? null,
            yourPoints: m.points,
            top3,
            isMember: true,
            isJoinable: m.group.isJoinable,
          };
        });

        // 3) Other joinable public groups (not yet joined)
        const other = await prisma.group.findMany({
          where: {
            visibility: "PUBLIC",
            isJoinable: true,
            members: { none: { userId } },
          },
          select: {
            id: true,
            name: true,
            competition: true,
            isJoinable: true,
            _count: { select: { members: true } },
          },
          orderBy: { createdAt: "desc" },
          take: query.take,
        });

        const otherPublicGroups = other.map((g) => ({
          id: g.id,
          name: g.name,
          competition: g.competition,
          memberCount: g._count.members,
          yourRank: null,
          yourPoints: 0,
          top3: [],
          isMember: false,
          isJoinable: g.isJoinable,
        }));

        return { yourPublicGroups, otherPublicGroups };
      }

      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: {
          groupId: true,
          points: true,
          createdAt: true,
          group: {
            select: {
              id: true,
              name: true,
              competition: true,
              _count: { select: { members: true } },
              members: {
                orderBy: { points: "desc" },
                take: 3,
                select: {
                  userId: true,
                  points: true,
                  user: { select: { name: true, username: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const groupIds = memberships.map((m) => m.groupId);

      const yourRanks =
        groupIds.length === 0
          ? []
          : await prisma.$queryRaw<Array<{ groupId: string; rank: number }>>`
              SELECT "groupId", "rank" FROM (
                SELECT
                  "groupId",
                  "userId",
                  DENSE_RANK() OVER (PARTITION BY "groupId" ORDER BY "points" DESC)::int AS "rank"
                FROM "GroupMember"
                WHERE "groupId" IN (${Prisma.join(groupIds)})
              ) t
              WHERE "userId" = ${userId}
            `;

      const rankByGroupId = new Map(yourRanks.map((r) => [r.groupId, r.rank] as const));

      const groups: GroupCardData[] = memberships.map((m) => {
        const top3 = m.group.members.map((row, idx) => ({
          position: idx + 1,
          name: row.user.username ?? row.user.name ?? "Unknown",
          points: row.points,
          isYou: row.userId === userId,
        }));

        return {
          id: m.group.id,
          name: m.group.name,
          competition: m.group.competition,
          memberCount: m.group._count.members,
          yourRank: rankByGroupId.get(m.groupId) ?? null,
          yourPoints: m.points,
          top3,
        };
      });

      return { groups };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });

  // Join by inviteCode (idempotent)
  app.post("/api/internal/groups/join", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const body = z
        .object({
          inviteCode: z.string().min(3),
        })
        .parse(req.body);

      const group = await prisma.group.findUnique({
        where: { inviteCode: body.inviteCode },
        select: { id: true, competitionSeasonId: true },
      });

      if (!group) return reply.code(404).send({ error: "Group not found" });

      const points = group.competitionSeasonId
        ? (
            await prisma.seasonUserPoints.findUnique({
              where: {
                competitionSeasonId_scoringSystem_userId: {
                  competitionSeasonId: group.competitionSeasonId,
                  scoringSystem: "CLASSIC",
                  userId,
                },
              },
              select: { points: true },
            })
          )?.points ?? 0
        : 0;

      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: { groupId: group.id, userId, role: "MEMBER", points },
        update: { points },
        select: { id: true },
      });

      // Auto-join official public group for the same season (if configured).
      if (group.competitionSeasonId) {
        const official = await prisma.officialPublicGroup.findUnique({
          where: { competitionSeasonId: group.competitionSeasonId },
          select: { groupId: true },
        });
        if (official) {
          await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: official.groupId, userId } },
            create: { groupId: official.groupId, userId, role: "MEMBER", points },
            update: { points },
            select: { id: true },
          });
        }
      }

      return { ok: true, groupId: group.id };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });

  // Invite preview (public, no auth) - used by /join page.
  app.get("/api/public/invites/:inviteCode", async (req, reply) => {
    try {
      const params = z.object({ inviteCode: z.string().min(3) }).parse(req.params);

      const group = await prisma.group.findUnique({
        where: { inviteCode: params.inviteCode },
        select: {
          id: true,
          name: true,
          sport: true,
          competition: true,
          visibility: true,
        },
      });

      if (!group) return reply.code(404).send({ error: "Group not found" });

      return { group };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}
