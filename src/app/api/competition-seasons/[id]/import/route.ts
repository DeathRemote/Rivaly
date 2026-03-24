import { NextResponse } from "next/server";

import { importCompetitionSeasonFixtures } from "@/lib/importers/competition-season-fixtures";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await importCompetitionSeasonFixtures({ competitionSeasonId: id });
  return NextResponse.json({ ok: true, result });
}
