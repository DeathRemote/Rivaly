import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

const ParamsSchema = z.object({ id: z.string().min(1) });
const PatchSchema = z.object({ published: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const p = ParamsSchema.safeParse(params);
  if (!p.success) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.competitionSeason.findUnique({
    where: { id: p.data.id },
    select: { id: true, archivedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (existing.archivedAt) {
    return NextResponse.json(
      { ok: false, error: "Cannot publish an archived season. Restore/unarchive first." },
      { status: 409 },
    );
  }

  const updated = await prisma.competitionSeason.update({
    where: { id: p.data.id },
    data: { published: body.data.published },
    select: { id: true, published: true },
  });

  revalidateTag("admin:catalog", "default");

  return NextResponse.json({ ok: true, season: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const p = ParamsSchema.safeParse(params);
  if (!p.success) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const season = await prisma.competitionSeason.findUnique({
    where: { id: p.data.id },
    select: { id: true, published: true, archivedAt: true },
  });

  if (!season) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Safe delete policy:
  // - If the season is "in use" (groups/matches/predictions/points events), do NOT hard-delete.
  // - Instead, archive + unpublish it.
  const [groupsCount, matchesCount, predictionsCount, pointsEventsCount] = await Promise.all([
    prisma.group.count({ where: { competitionSeasonId: p.data.id } }),
    prisma.match.count({ where: { competitionSeasonId: p.data.id } }),
    prisma.prediction.count({ where: { match: { competitionSeasonId: p.data.id } } }),
    prisma.pointsEvent.count({ where: { match: { competitionSeasonId: p.data.id } } }),
  ]);

  const inUse = groupsCount > 0 || matchesCount > 0 || predictionsCount > 0 || pointsEventsCount > 0;

  if (inUse) {
    const archived = await prisma.competitionSeason.update({
      where: { id: p.data.id },
      data: {
        published: false,
        archivedAt: season.archivedAt ?? new Date(),
      },
      select: { id: true, archivedAt: true, published: true },
    });

    revalidateTag("admin:catalog", "default");

    return NextResponse.json({
      ok: true,
      action: "archived",
      reason: "Season is in use; archived instead of hard-deleting.",
      usage: { groupsCount, matchesCount, predictionsCount, pointsEventsCount },
      season: archived,
    });
  }

  await prisma.competitionSeason.delete({ where: { id: p.data.id } });

  revalidateTag("admin:catalog", "default");

  return NextResponse.json({ ok: true, action: "deleted" });
}
