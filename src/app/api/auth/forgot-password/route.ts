import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { generateResetToken, hashResetToken } from "@/lib/auth/password-reset";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Always return 200 to avoid leaking which emails exist.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true });

  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);

  // Optionally invalidate older tokens for this user.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // TODO: wire up email sending (Resend/Sendgrid/etc). For now we log in dev.
  const origin =
    req.headers.get("origin") ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const resetUrl = `${origin}/reset-password?token=${rawToken}`;

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Rivaly] Password reset link:", resetUrl);
  }

  return NextResponse.json({ ok: true });
}
