import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

const ParamsSchema = z.object({ id: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";

  try {
    const result = await syncCompetitionSeasonStandings({ competitionSeasonId: parsed.data.id, reset });

    // Admin UI lists seasons with standingsUpdatedAt; make sure it refreshes.
    revalidateTag("admin:catalog", "default");

    return NextResponse.json({ ok: true, reset, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    revalidateTag("admin:catalog", "default");
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
