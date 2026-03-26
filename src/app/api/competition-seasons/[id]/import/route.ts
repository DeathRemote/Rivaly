import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { importCompetitionSeasonFixtures } from "@/lib/importers/competition-season-fixtures";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const url = new URL(req.url);

  // Destructive, but useful while we iterate (e.g. if partial fixtures were imported).
  const reset = url.searchParams.get("reset") === "1";

  if (reset) {
    await prisma.match.deleteMany({ where: { competitionSeasonId: id } });
    await prisma.competitionPhase.deleteMany({ where: { competitionSeasonId: id } });
  }

  const result = await importCompetitionSeasonFixtures({ competitionSeasonId: id });
  return NextResponse.json({ ok: true, reset, result });
}
