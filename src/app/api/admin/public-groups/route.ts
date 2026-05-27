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
    return NextResponse.json({ ok: true, groupId: existing.groupId, created: false });
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
        inviteCode,
        createdById: admin.userId,
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
      await tx.groupMember.createMany({
        data: users.map((u) => ({ groupId: group.id, userId: u.userId, role: "MEMBER", points: 0 })),
        skipDuplicates: true,
      });
    }

    return { groupId: group.id, membersBackfilled: users.length };
  });

  return NextResponse.json({ ok: true, created: true, ...created });
}
