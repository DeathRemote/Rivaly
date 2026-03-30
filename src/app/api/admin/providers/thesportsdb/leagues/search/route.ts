import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { TheSportsDbClient } from "@/lib/providers/thesportsdb/client";

const QuerySchema = z.object({
  q: z.string().trim().min(2),
  sport: z.enum(["SOCCER"]).optional(),
});

// Simple in-memory cache to avoid refetching the full league list repeatedly.
// This runs per server instance.
let cachedAllLeagues:
  | {
      fetchedAtMs: number;
      leagues: Awaited<ReturnType<TheSportsDbClient["listAllLeagues"]>>;
    }
  | undefined;

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    sport: (url.searchParams.get("sport") ?? undefined) as "SOCCER" | undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }

  const q = parsed.data.q.toLowerCase();
  const maxAgeMs = 6 * 60 * 60 * 1000;

  if (!cachedAllLeagues || Date.now() - cachedAllLeagues.fetchedAtMs > maxAgeMs) {
    const client = new TheSportsDbClient();
    const leagues = await client.listAllLeagues();
    cachedAllLeagues = { fetchedAtMs: Date.now(), leagues };
  }

  const filtered = cachedAllLeagues.leagues
    .filter((l) => {
      const sport = (l.strSport ?? "").toLowerCase();
      if (sport !== "soccer") return false;

      const name = l.strLeague.toLowerCase();
      const alt = (l.strLeagueAlternate ?? "").toLowerCase();

      return name.includes(q) || (alt && alt.includes(q));
    })
    .slice(0, 20)
    .map((l) => ({
      idLeague: l.idLeague,
      name: l.strLeague,
      sport: l.strSport ?? null,
      alternateName: l.strLeagueAlternate ?? null,
    }));

  return NextResponse.json({ ok: true, results: filtered });
}
