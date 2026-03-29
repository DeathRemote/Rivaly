import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { scoreMatchById } from "@/lib/pipeline/score-match";

export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  // Never allow this in production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Require admin session for safety (dev route).
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { matchId } = await ctx.params;

  const body = (await req.json().catch(() => null)) as
    | { homeScore?: number; awayScore?: number }
    | null;

  const homeScore = body?.homeScore;
  const awayScore = body?.awayScore;

  if (typeof homeScore !== "number" || typeof awayScore !== "number") {
    return NextResponse.json(
      { ok: false, error: "homeScore and awayScore are required numbers" },
      { status: 400 },
    );
  }

  try {
    const res = await scoreMatchById({ matchId, homeScore, awayScore });
    return NextResponse.json(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
