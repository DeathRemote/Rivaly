import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { recomputeGroupMemberAccuracyAggregate, recomputeGroupMomentumAggregate } from "@/lib/aggregates/recompute";

export async function POST(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const { groupId } = await ctx.params;

  await recomputeGroupMemberAccuracyAggregate(groupId);
  await recomputeGroupMomentumAggregate(groupId);

  return NextResponse.json({ ok: true, groupId });
}

export async function GET(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  return POST(req, ctx);
}
