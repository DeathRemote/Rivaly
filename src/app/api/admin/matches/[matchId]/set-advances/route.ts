import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

const ParamsSchema = z.object({ matchId: z.string().min(1) });
const BodySchema = z.object({ advancesTeamId: z.string().min(1).nullable() });

export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const params = ParamsSchema.safeParse(await ctx.params);
  if (!params.success) return NextResponse.json({ ok: false, error: "Invalid matchId" }, { status: 400 });

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

  const match = await prisma.match.findUnique({
    where: { id: params.data.matchId },
    select: {
      id: true,
      knockoutRound: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
      result: { select: { id: true, homeScore: true, awayScore: true } },
    },
  });

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });

  if (!match.knockoutRound) {
    return NextResponse.json({ ok: false, error: "This match is not a knockout match." }, { status: 409 });
  }

  if (!match.result) {
    return NextResponse.json(
      { ok: false, error: "No MatchResult exists yet for this match." },
      { status: 409 },
    );
  }

  if (match.result.homeScore !== match.result.awayScore) {
    return NextResponse.json(
      { ok: false, error: "This match is not a draw; advances is implied by the score." },
      { status: 409 },
    );
  }

  const advancesTeamId = body.data.advancesTeamId;
  if (advancesTeamId && advancesTeamId !== match.homeTeamId && advancesTeamId !== match.awayTeamId) {
    return NextResponse.json({ ok: false, error: "advancesTeamId must be home or away team." }, { status: 400 });
  }

  const updated = await prisma.matchResult.update({
    where: { matchId: match.id },
    data: { advancesTeamId },
    select: { matchId: true, advancesTeamId: true },
  });

  // IMPORTANT: we intentionally do NOT force-rescore here.
  // Our post-match processor will pick this match up again (processedAt remains null for this case)
  // and score once the advancesTeamId is known.

  return NextResponse.json({ ok: true, result: updated });
}
