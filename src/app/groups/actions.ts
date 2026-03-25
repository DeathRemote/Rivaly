"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/group-code";

const createGroupSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]),
    // For SOCCER we use canonical seasons; for other sports we keep free-text until ingested.
    competitionSeasonId: z.string().trim().min(1).optional(),
    competition: z.string().trim().min(2).max(60).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.sport === "SOCCER") {
      if (!val.competitionSeasonId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["competitionSeasonId"],
          message: "Select a competition season.",
        });
      }
    } else {
      if (!val.competition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["competition"],
          message: "Select a competition.",
        });
      }
    }
  });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export type CreateGroupResult =
  | { ok: true; groupId: string; inviteCode: string }
  | { ok: false; error: string };

export async function createGroupAction(input: CreateGroupInput): Promise<CreateGroupResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { name, sport, competitionSeasonId, competition } = parsed.data;

  // Generate a short, uppercase invite code server-side.
  // Ensure uniqueness using the DB unique constraint, retrying on collisions.
  for (let attempt = 0; attempt < 10; attempt++) {
    const inviteCode = generateInviteCode(8);

    try {
      let competitionLabel = competition ?? "";

      if (sport === "SOCCER") {
        const season = await prisma.competitionSeason.findFirst({
          where: { id: competitionSeasonId, published: true },
          include: { competition: true },
        });
        if (!season) return { ok: false, error: "Selected competition season not found." };
        competitionLabel = `${season.competition.name} ${season.seasonLabel}`;
      }

      const created = await prisma.group.create({
        data: {
          name,
          sport,
          competition: competitionLabel,
          competitionSeasonId: sport === "SOCCER" ? competitionSeasonId : null,
          inviteCode,
          createdById: userId,
          members: {
            create: {
              userId,
              role: "ADMIN",
              points: 0,
            },
          },
        },
        select: { id: true, inviteCode: true, competitionSeasonId: true },
      });

      // Ensure fixtures + table exist in DB.
      // Important: only do the heavy imports the *first* time a season is used.
      if (sport === "SOCCER" && created.competitionSeasonId) {
        const [matchCount, tableCount] = await Promise.all([
          prisma.match.count({ where: { competitionSeasonId: created.competitionSeasonId } }),
          prisma.standingsRow.count({ where: { competitionSeasonId: created.competitionSeasonId } }),
        ]);

        if (matchCount === 0) {
          const { importCompetitionSeasonFixtures } = await import(
            "@/lib/importers/competition-season-fixtures"
          );
          try {
            await importCompetitionSeasonFixtures({
              competitionSeasonId: created.competitionSeasonId,
            });
          } catch (err) {
            console.warn(
              "[fixtures] import failed during group creation:",
              err instanceof Error ? err.message : err,
            );
          }
        }

        if (tableCount === 0) {
          const { syncCompetitionSeasonStandings } = await import(
            "@/lib/importers/competition-season-standings"
          );
          try {
            await syncCompetitionSeasonStandings({ competitionSeasonId: created.competitionSeasonId });
          } catch (err) {
            console.warn(
              "[standings] sync failed during group creation:",
              err instanceof Error ? err.message : err,
            );
          }
        }
      }

      revalidatePath("/groups");
      return { ok: true, groupId: created.id, inviteCode: created.inviteCode };
    } catch (err) {
      // Prisma unique constraint violation
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Group_inviteCode_key") || msg.includes("inviteCode")) {
        continue; // collision, retry
      }
      return { ok: false, error: "Failed to create group. Please try again." };
    }
  }

  return { ok: false, error: "Failed to generate a unique invite code. Please try again." };
}

const joinGroupSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().min(6).max(12),
});

export type JoinGroupInput = z.infer<typeof joinGroupSchema>;

export type JoinGroupResult =
  | { ok: true; groupId: string; groupName: string }
  | { ok: false; error: string };

export async function joinGroupAction(input: JoinGroupInput): Promise<JoinGroupResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid invite code." };

  const inviteCode = parsed.data.inviteCode.replace(/\s+/g, "");

  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, name: true },
  });

  if (!group) return { ok: false, error: "That invite code doesn’t match any group." };

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: "You’re already a member of this group." };
  }

  try {
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "MEMBER",
        points: 0,
      },
      select: { id: true },
    });

    revalidatePath("/groups");
    return { ok: true, groupId: group.id, groupName: group.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("GroupMember_groupId_userId_key") || msg.includes("groupId_userId")) {
      return { ok: false, error: "You’re already a member of this group." };
    }

    return { ok: false, error: "Failed to join group. Please try again." };
  }
}

const leaveGroupSchema = z.object({
  groupId: z.string().min(1),
});

export type LeaveGroupInput = z.infer<typeof leaveGroupSchema>;
export type LeaveGroupResult = { ok: true } | { ok: false; error: string };

export async function leaveGroupAction(input: LeaveGroupInput): Promise<LeaveGroupResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = leaveGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, createdById: true },
  });

  if (!group) return { ok: false, error: "Group not found." };
  if (group.createdById === userId) {
    return { ok: false, error: "Group owner can’t leave. Delete the group instead." };
  }

  // Remove membership.
  // Predictions are global per user+match and are NOT deleted when leaving a group.
  await prisma.groupMember.deleteMany({
    where: { groupId: group.id, userId },
  });

  revalidatePath("/groups");

  return { ok: true };
}

const deleteGroupSchema = z.object({
  groupId: z.string().min(1),
});

export type DeleteGroupInput = z.infer<typeof deleteGroupSchema>;
export type DeleteGroupResult = { ok: true } | { ok: false; error: string };

export async function deleteGroupAction(input: DeleteGroupInput): Promise<DeleteGroupResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const ownerEmail = process.env.OWNER_EMAIL;
  const userEmail = session?.user?.email;
  const userRole = session?.user?.role;

  const isOwner = Boolean(ownerEmail && userEmail && userEmail === ownerEmail);
  const isAdmin = isOwner || userRole === "ADMIN";

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, createdById: true },
  });

  if (!group) return { ok: false, error: "Group not found." };

  if (group.createdById !== userId && !isAdmin) {
    return { ok: false, error: "Only the group owner can delete this group." };
  }

  // Cascade will remove GroupMember + PointsEvents due to FK onDelete: Cascade.
  // NOTE: We do NOT delete competition season fixtures here because they are shared.
  // NOTE: Predictions are global per user+match and are not tied to a group, so we do not delete them here.
  await prisma.group.delete({ where: { id: group.id } });

  revalidatePath("/groups");

  return { ok: true };
}
