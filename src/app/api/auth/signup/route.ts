import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  country: z.string().length(2),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue?.message || "Invalid input",
        field: (issue?.path?.[0] as string | undefined) ?? undefined,
      },
      { status: 400 },
    );
  }

  const { username, country, email, password } = parsed.data;

  const normalizedUsername = username.trim();
  const normalizedCountry = country.trim().toUpperCase();

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  }

  const existingByUsername = await prisma.user.findUnique({ where: { username: normalizedUsername } });
  if (existingByUsername) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username: normalizedUsername,
      country: normalizedCountry,
      // Use username as the default display name for now.
      name: normalizedUsername,
      password: {
        create: { passwordHash },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
