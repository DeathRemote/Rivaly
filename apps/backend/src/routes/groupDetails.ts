import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export type GroupDetailsPayload = {
  group: {
    id: string;
    name: string;
    sport: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";
    competition: string;
    competitionSeasonId: string | null;
    memberCount: number;
    createdById: string;
  };
  membership: {
    role: "MEMBER" | "ADMIN";
    points: number;
  };
  inviteCode: string | null;
  canDelete: boolean;
};

export async function registerGroupDetailsRoutes(app: FastifyInstance) {
  app.get("/api/internal/groups/:groupId", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const params = z.object({ groupId: z.string().min(1) }).parse(req.params);

      const group = await prisma.group.findUnique({
        where: { id: params.groupId },
        select: {
          id: true,
          name: true,
          sport: true,
          competition: true,
          competitionSeasonId: true,
          inviteCode: true,
          createdById: true,
          _count: { select: { members: true } },
          members: {
            where: { userId },
            select: { role: true, points: true },
            take: 1,
          },
        },
      });

      if (!group) return reply.code(404).send({ error: "Group not found" });

      const membership = group.members[0];
      if (!membership) return reply.code(403).send({ error: "Forbidden" });

      const payload: GroupDetailsPayload = {
        group: {
          id: group.id,
          name: group.name,
          sport: group.sport,
          competition: group.competition,
          competitionSeasonId: group.competitionSeasonId,
          memberCount: group._count.members,
          createdById: group.createdById,
        },
        membership: {
          role: membership.role,
          points: membership.points,
        },
        inviteCode: group.inviteCode,
        canDelete: group.createdById === userId || membership.role === "ADMIN",
      };

      return payload;
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}
