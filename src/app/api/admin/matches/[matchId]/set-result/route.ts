import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

const ParamsSchema = z.object({ matchId: z.string().min(1) });

const BodySchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
});

/**
 * Manual MatchResult override.
 *
 * Purpose: When provider sync fails, allow admins to set the final score for a match.
 * This does NOT rescore points automatically (kept separate by design).
 */
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
      status: true,
      finalizedAt: true,
      processedAt: true,
      competitionSeasonId: true,
    },
  });

  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
  if (!match.competitionSeasonId) {
    return NextResponse.json({ ok: false, error: "Match has no competitionSeasonId" }, { status: 409 });
  }

  const { homeScore, awayScore } = body.data;

  const out = await prisma.$transaction(async (tx) => {
    const result = await tx.matchResult.upsert({
      where: { matchId: match.id },
      create: {
        matchId: match.id,
        homeScore,
        awayScore,
        // provider + providerEventId intentionally left null for manual overrides
      },
      update: {
        homeScore,
        awayScore,
      },
      select: { matchId: true, homeScore: true, awayScore: true, advancesTeamId: true },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "FINISHED",
        finalizedAt: new Date(),
        // Keep processedAt null so post-match pipeline (or manual rescore) can run.
        processedAt: null,
      },
      select: { id: true },
    });

    return result;
  });

  return NextResponse.json({ ok: true, result: out });
}
