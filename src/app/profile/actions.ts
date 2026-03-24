"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),

  currentPassword: z.string().min(6).optional().or(z.literal("")),
  newPassword: z.string().min(8).optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type UpdateProfileResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      field?: "displayName" | "username" | "email" | "currentPassword" | "newPassword";
    };

export async function updateProfileAction(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You must be logged in." };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const displayName = parsed.data.displayName;
  const username = parsed.data.username?.trim() || null;
  const email = parsed.data.email?.trim() || null;

  const currentPassword = parsed.data.currentPassword || null;
  const newPassword = parsed.data.newPassword || null;

  // Enforce password update rules.
  const wantsPasswordChange = Boolean(newPassword && newPassword.length > 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      password: { select: { passwordHash: true } },
    },
  });

  if (!user) return { ok: false, error: "User not found." };

  if (wantsPasswordChange) {
    const hasPassword = Boolean(user.password?.passwordHash);

    if (hasPassword) {
      if (!currentPassword) {
        return {
          ok: false,
          error: "Enter your current password to set a new one.",
          field: "currentPassword",
        };
      }

      const ok = await bcrypt.compare(currentPassword, user.password!.passwordHash);
      if (!ok) {
        return { ok: false, error: "Current password is incorrect.", field: "currentPassword" };
      }
    }

    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: "New password must be at least 8 characters.", field: "newPassword" };
    }
  }

  // Username uniqueness
  if (username && username !== user.username) {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      return { ok: false, error: "That username is already taken.", field: "username" };
    }
  }

  // Email uniqueness
  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      return { ok: false, error: "That email is already in use.", field: "email" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: displayName,
        username: username,
        email: email,
      },
      select: { id: true },
    });

    if (wantsPasswordChange) {
      const passwordHash = await bcrypt.hash(newPassword!, 10);

      await tx.userPassword.upsert({
        where: { userId },
        create: { userId, passwordHash },
        update: { passwordHash },
        select: { userId: true },
      });
    }
  });

  return { ok: true };
}
