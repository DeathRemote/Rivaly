import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

const QuerySchema = z.object({
  email: z.string().trim().email(),
});

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ email: url.searchParams.get("email") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      image: true,
      role: true,
      accountTier: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return NextResponse.json({ ok: true, user: null });

  return NextResponse.json({ ok: true, user });
}

const PatchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"]).optional(),
  accountTier: z.enum(["FREE", "BASIC", "PRO", "ELITE", "FRIENDS_AND_FAMILY"]).optional(),
});

export async function PATCH(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!parsed.data.role && !parsed.data.accountTier) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.accountTier ? { accountTier: parsed.data.accountTier } : {}),
    },
    select: { id: true, role: true, accountTier: true },
  });

  // Invalidate cached admin reads.
  revalidateTag("admin:stats", "default");

  return NextResponse.json({ ok: true, user: updated });
}
