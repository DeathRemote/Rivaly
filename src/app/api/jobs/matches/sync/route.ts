import { NextResponse } from "next/server";

import { requireJobAuth } from "@/lib/jobs/auth";
import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

async function runJob(req: Request) {
  const auth = await requireJobAuth(req);
  if (!auth.ok) return auth.response;

  const result = await syncAndProcessFinishedMatches({
    maxMatches: 50,
    lookbackHours: 7 * 24,
    lookaheadMinutes: 60,
  });

  return NextResponse.json({ ok: true, auth: auth.mode, result });
}

export async function POST(req: Request) {
  return runJob(req);
}

// Vercel Cron may call GET by default depending on configuration.
// We support GET as an alias for POST so the job still runs.
export async function GET(req: Request) {
  return runJob(req);
}
