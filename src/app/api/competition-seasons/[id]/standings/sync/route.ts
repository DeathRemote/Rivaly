import { NextResponse } from "next/server";

import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

export async function POST(req: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";

  const result = await syncCompetitionSeasonStandings({ competitionSeasonId: id, reset });
  return NextResponse.json({ ok: true, reset, result });
}
