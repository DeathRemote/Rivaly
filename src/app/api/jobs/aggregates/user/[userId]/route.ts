import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { recomputeUserPredictionStatsAggregate } from "@/lib/aggregates/recompute";

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  await recomputeUserPredictionStatsAggregate(userId);

  return NextResponse.json({ ok: true, userId });
}

export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return POST(req, ctx);
}
