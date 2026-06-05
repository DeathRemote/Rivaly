import { z } from "zod";
import type { FastifyInstance } from "fastify";

import { prisma } from "../prisma.js";
import { requireUserAuth } from "../auth.js";

export async function registerPublicGroupRoutes(app: FastifyInstance) {
  // Join a joinable public group by id.
  app.post("/api/internal/public-groups/join", async (req, reply) => {
    try {
      const { userId } = await requireUserAuth(req.headers.authorization);

      const body = z.object({ groupId: z.string().min(1) }).parse(req.body);

      const group = await prisma.group.findUnique({
        where: { id: body.groupId },
        select: { id: true, visibility: true, isJoinable: true },
      });

      if (!group) return reply.code(404).send({ error: "Group not found" });
      if (group.visibility !== "PUBLIC" || !group.isJoinable) {
        return reply.code(403).send({ error: "This public group is not joinable" });
      }

      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: { groupId: group.id, userId, role: "MEMBER", points: 0 },
        update: {},
        select: { id: true },
      });

      return { ok: true };
    } catch (err: any) {
      const status = err?.statusCode ?? 400;
      return reply.code(status).send({ error: err?.message ?? "Bad Request" });
    }
  });
}
