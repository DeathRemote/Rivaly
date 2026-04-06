import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { prisma } from "@/lib/prisma";
import { syncCompetitionSeasonStandings } from "@/lib/importers/competition-season-standings";

async function runJob(req: Request) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "5");
  const staleMinutes = Number(url.searchParams.get("staleMinutes") ?? "60");

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 5;
  const safeStaleMinutes = Number.isFinite(staleMinutes) ? Math.min(Math.max(staleMinutes, 5), 24 * 60) : 60;

  const cutoff = new Date(Date.now() - safeStaleMinutes * 60 * 1000);

  // Backstop: refresh standings periodically so tables don't remain stale forever.
  // We sync only seasons whose standings are missing or older than the cutoff.
  // Keep the batch small to avoid hammering providers.
  const seasons = await prisma.competitionSeason.findMany({
    where: {
      provider: "THESPORTSDB",
      OR: [{ standingsUpdatedAt: null }, { standingsUpdatedAt: { lt: cutoff } }],
    },
    orderBy: [{ standingsUpdatedAt: "asc" }, { createdAt: "asc" }],
    take: safeLimit,
    select: { id: true },
  });

  const out: Array<{ competitionSeasonId: string; ok: boolean; error?: string }> = [];

  for (const s of seasons) {
    try {
      await syncCompetitionSeasonStandings({ competitionSeasonId: s.id });
      out.push({ competitionSeasonId: s.id, ok: true });
    } catch (err) {
      out.push({
        competitionSeasonId: s.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, auth: auth.mode, cutoff, synced: out.length, results: out });
}

export async function POST(req: Request) {
  return runJob(req);
}

// Vercel Cron may call GET by default depending on configuration.
export async function GET(req: Request) {
  return runJob(req);
}
