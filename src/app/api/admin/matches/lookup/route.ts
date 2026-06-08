import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);

  const parsed = z
    .object({
      providerMatchId: z.string().min(1).optional(),
      matchId: z.string().min(1).optional(),
    })
    .safeParse({
      providerMatchId: searchParams.get("providerMatchId") ?? undefined,
      matchId: searchParams.get("matchId") ?? undefined,
    });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }

  const { providerMatchId, matchId } = parsed.data;

  if (!providerMatchId && !matchId) {
    return NextResponse.json(
      { ok: false, error: "Provide providerMatchId or matchId" },
      { status: 400 },
    );
  }

  const match = await prisma.match.findFirst({
    where: matchId
      ? { id: matchId }
      : {
          provider: "THESPORTSDB",
          providerMatchId: providerMatchId!,
        },
    select: {
      id: true,
      status: true,
      kickoffAt: true,
      provider: true,
      providerMatchId: true,
      knockoutRound: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      result: { select: { homeScore: true, awayScore: true, advancesTeamId: true } },
      competitionSeason: { select: { id: true, seasonLabel: true, competition: { select: { name: true } } } },
      competitionPhase: { select: { type: true, name: true } },
    },
  });

  if (!match) return NextResponse.json({ ok: true, match: null });

  return NextResponse.json({ ok: true, match });
}
