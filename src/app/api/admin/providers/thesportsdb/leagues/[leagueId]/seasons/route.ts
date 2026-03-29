import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";

const ParamsSchema = z.object({ leagueId: z.string().min(1) });

export async function GET(_req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = await ctx.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid leagueId" }, { status: 400 });
  }

  const client = new TheSportsDbClient();
  const seasons = await client.listSeasonsForLeague(parsed.data.leagueId);

  // Sort descending-ish (usually year strings)
  const labels = seasons
    .map((s) => ({ seasonLabel: s.strSeason, providerSeasonId: s.idSeason ?? null }))
    .filter((s) => s.seasonLabel)
    .sort((a, b) => (a.seasonLabel < b.seasonLabel ? 1 : a.seasonLabel > b.seasonLabel ? -1 : 0));

  return NextResponse.json({ ok: true, seasons: labels });
}
