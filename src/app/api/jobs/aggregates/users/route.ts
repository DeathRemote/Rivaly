import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { recomputeAllUserAggregates } from "@/lib/aggregates/recompute";

export async function POST(req: Request) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const batchSize = Number(url.searchParams.get("batchSize") ?? "50");

  const res = await recomputeAllUserAggregates({ batchSize: Number.isFinite(batchSize) ? batchSize : 50 });
  return NextResponse.json({ ok: true, ...res });
}

export async function GET(req: Request) {
  return POST(req);
}
