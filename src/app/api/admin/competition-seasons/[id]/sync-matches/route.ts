import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";
import { importCompetitionSeasonFixtures } from "@/lib/importers/competition-season-fixtures";

const ParamsSchema = z.object({ id: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";

  if (reset) {
    // Destructive reset (matches+phases) before re-import.
    await prisma.match.deleteMany({ where: { competitionSeasonId: parsed.data.id } });
    await prisma.competitionPhase.deleteMany({ where: { competitionSeasonId: parsed.data.id } });
  }

  try {
    const result = await importCompetitionSeasonFixtures({ competitionSeasonId: parsed.data.id });
    await prisma.competitionSeason.update({
      where: { id: parsed.data.id },
      data: { fixturesSyncedAt: new Date(), fixturesSyncError: null },
    });

    revalidateTag("admin:catalog", "default");
    return NextResponse.json({ ok: true, reset, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.competitionSeason.update({
      where: { id: parsed.data.id },
      data: { fixturesSyncedAt: null, fixturesSyncError: msg.slice(0, 800) },
    });

    revalidateTag("admin:catalog", "default");
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
