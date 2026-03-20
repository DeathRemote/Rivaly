import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/auth/password-reset";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.userPassword.upsert({
      where: { userId: reset.userId },
      create: { userId: reset.userId, passwordHash },
      update: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: reset.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
