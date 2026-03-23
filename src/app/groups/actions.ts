"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/group-code";

const createGroupSchema = z.object({
  name: z.string().trim().min(3).max(60),
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]),
  competition: z.string().trim().min(2).max(60),
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

  const { name, sport, competition } = parsed.data;

  // Generate a short, uppercase invite code server-side.
  // Ensure uniqueness using the DB unique constraint, retrying on collisions.
  for (let attempt = 0; attempt < 10; attempt++) {
    const inviteCode = generateInviteCode(8);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name,
            sport,
            competition,
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
          select: { id: true, inviteCode: true },
        });

        return group;
      });

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
