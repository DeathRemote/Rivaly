import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = z
    .object({
      // If set, only retry jobs updated within the last N minutes.
      minutes: z.number().int().positive().max(60 * 24 * 14).optional(),
      // If set, retry only jobs for this match (dedupeKey=matchId).
      matchId: z.string().min(1).optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }

  const since = parsed.data.minutes
    ? new Date(Date.now() - parsed.data.minutes * 60 * 1000)
    : null;

  const where: any = {
    type: "SCORE_MATCH",
    status: "FAILED",
  };
  if (since) where.updatedAt = { gte: since };
  if (parsed.data.matchId) where.dedupeKey = parsed.data.matchId;

  const res = await prisma.job.updateMany({
    where,
    data: {
      status: "QUEUED",
      lockedAt: null,
      lockedBy: null,
      runAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, retried: res.count });
}
