import { NextResponse } from "next/server";

import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

function assertAuthorized(req: Request) {
  const required = process.env.JOB_SECRET;
  if (!required) return;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const header = req.headers.get("x-job-secret");

  const ok = (token && token === required) || (header && header === required);
  if (!ok) {
    throw new Error("UNAUTHORIZED");
  }
}

async function runJob(req: Request) {
  assertAuthorized(req);

  const result = await syncAndProcessFinishedMatches({
    maxMatches: 50,
    lookbackHours: 6,
    lookaheadMinutes: 60,
  });

  return NextResponse.json({ ok: true, result });
}

export async function POST(req: Request) {
  try {
    return await runJob(req);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Vercel Cron may call GET by default depending on configuration.
// We support GET as an alias for POST so the job still runs.
export async function GET(req: Request) {
  try {
    return await runJob(req);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
