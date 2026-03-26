import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

const ParamsSchema = z.object({ id: z.string().min(1) });
const PatchSchema = z.object({ published: z.boolean() });

export async function PATCH(req: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const p = ParamsSchema.safeParse(params);
  if (!p.success) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.competition.update({
    where: { id: p.data.id },
    data: { published: body.data.published },
    select: { id: true, published: true },
  });

  revalidateTag("admin:catalog");

  return NextResponse.json({ ok: true, competition: updated });
}
