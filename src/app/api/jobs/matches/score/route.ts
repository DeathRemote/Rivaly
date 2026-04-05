import { NextResponse } from "next/server";
import { z } from "zod";

import { requireJobAuth } from "@/lib/jobs/auth";
import { scoreMatchById } from "@/lib/pipeline/score-match";

const PayloadSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  providerEventId: z.string().min(1).optional().nullable(),
});

async function parsePayload(req: Request) {
  // Allow both JSON body (POST) and query params (GET/manual curl).
  const url = new URL(req.url);

  const hasQuery = url.searchParams.get("matchId");
  if (hasQuery) {
    return PayloadSchema.parse({
      matchId: url.searchParams.get("matchId"),
      homeScore: Number(url.searchParams.get("homeScore")),
      awayScore: Number(url.searchParams.get("awayScore")),
      providerEventId: url.searchParams.get("providerEventId"),
    });
  }

  const json = await req.json().catch(() => null);
  return PayloadSchema.parse(json);
}

async function run(req: Request) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const payload = await parsePayload(req);
  const result = await scoreMatchById(payload);

  return NextResponse.json({ ok: true, auth: auth.mode, result });
}

export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}
