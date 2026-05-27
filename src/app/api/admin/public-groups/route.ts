import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin/api-auth";

const BodySchema = z.object({
  competitionSeasonId: z.string().min(1),
  // Optional override for group name.
  name: z.string().min(3).max(60).optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const json = await req.json().catch(() => null);
  const body = BodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const season = await prisma.competitionSeason.findUnique({
    where: { id: body.data.competitionSeasonId },
    include: { competition: true },
  });

  if (!season) {
    return NextResponse.json({ ok: false, error: "Competition season not found" }, { status: 404 });
  }

  const existing = await prisma.officialPublicGroup.findUnique({
    where: { competitionSeasonId: season.id },
    include: { group: { select: { id: true } } },
  });

  if (existing) {
    // Repair: sync points for existing official group from canonical SeasonUserPoints.
    // Useful when the official group was created before the season ledger existed.
    await prisma.$executeRaw`
      UPDATE "GroupMember" gm
      SET "points" = sup."points"
      FROM "Group" g
      JOIN "SeasonUserPoints" sup
        ON sup."competitionSeasonId" = g."competitionSeasonId"
       AND sup."scoringSystem" = g."scoringSystem"
       AND sup."userId" = gm."userId"
      WHERE gm."groupId" = g."id"
        AND g."id" = ${existing.groupId};
    `;

    return NextResponse.json({ ok: true, groupId: existing.groupId, created: false, repaired: true });
  }

  const name = body.data.name ?? `${season.competition.name} ${season.seasonLabel} — Global`;

  // Create the group + official mapping.
  // Note: inviteCode is required by schema; we still generate one even though this is not joinable.
  // Users get membership automatically via season participation.
  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name,
        sport: season.competition.sport,
        competition: `${season.competition.name} ${season.seasonLabel}`,
        competitionSeasonId: season.id,
        visibility: "PUBLIC",
        isJoinable: false,
        scoringSystem: "CLASSIC",
        inviteCode,
        createdById: admin.session.user.id,
      },
      select: { id: true },
    });

    await tx.officialPublicGroup.create({
      data: {
        competitionSeasonId: season.id,
        groupId: group.id,
      },
      select: { id: true },
    });

    // Backfill: add ALL users who are members of ANY group with this competitionSeasonId.
    // This is idempotent due to GroupMember @@unique(groupId,userId).
    const users = await tx.groupMember.findMany({
      where: { group: { competitionSeasonId: season.id } },
      distinct: ["userId"],
      select: { userId: true },
    });

    if (users.length) {
      // Pull current season points (classic) so the official group shows the same points as any other classic group.
      const pointsRows = await tx.seasonUserPoints.findMany({
        where: { competitionSeasonId: season.id, scoringSystem: "CLASSIC", userId: { in: users.map((u) => u.userId) } },
        select: { userId: true, points: true },
      });
      const pointsByUser = new Map(pointsRows.map((r) => [r.userId, r.points] as const));

      await tx.groupMember.createMany({
        data: users.map((u) => ({
          groupId: group.id,
          userId: u.userId,
          role: "MEMBER",
          points: pointsByUser.get(u.userId) ?? 0,
        })),
        skipDuplicates: true,
      });
    }

    return { groupId: group.id, membersBackfilled: users.length };
  });

  return NextResponse.json({ ok: true, created: true, ...created });
}
