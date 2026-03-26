import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getSportConfigsCached } from "@/lib/admin/sports";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const rows = await getSportConfigsCached();
  return NextResponse.json({ ok: true, sports: rows });
}

const PatchSchema = z.object({
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]),
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.sportConfig.upsert({
    where: { sport: parsed.data.sport },
    create: { sport: parsed.data.sport, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  });

  revalidateTag("admin:catalog");

  return NextResponse.json({ ok: true, sport: updated });
}
