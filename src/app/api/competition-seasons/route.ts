import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ensureAllsvenskan2026Published } from "@/lib/competitions/ensure-allsvenskan-2026";

const QuerySchema = z.object({
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]).optional(),
});

export async function GET(req: Request) {
  // For the first real test: ensure Allsvenskan exists so it can be selected.
  await ensureAllsvenskan2026Published();

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    sport: url.searchParams.get("sport") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }

  const seasons = await prisma.competitionSeason.findMany({
    where: {
      published: true,
      archivedAt: null,
      competition: {
        published: true,
        ...(parsed.data.sport ? { sport: parsed.data.sport } : {}),
      },
    },
    include: {
      competition: true,
    },
    orderBy: [{ competition: { name: "asc" } }, { seasonLabel: "desc" }],
  });

  return NextResponse.json({
    ok: true,
    seasons: seasons.map((s) => ({
      id: s.id,
      name: s.competition.name,
      seasonLabel: s.seasonLabel,
      sport: s.competition.sport,
      country: s.competition.country,
    })),
  });
}
