import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { recomputeAllGroupAggregates } from "@/lib/aggregates/recompute";

export async function POST(req: Request) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const batchSize = Number(url.searchParams.get("batchSize") ?? "25");

  const res = await recomputeAllGroupAggregates({ batchSize: Number.isFinite(batchSize) ? batchSize : 25 });
  return NextResponse.json({ ok: true, ...res });
}

export async function GET(req: Request) {
  // Allow GET for quick manual trigger (still requires auth)
  return POST(req);
}
