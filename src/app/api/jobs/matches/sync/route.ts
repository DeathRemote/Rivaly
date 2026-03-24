import { NextResponse } from "next/server";

import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

export async function POST(req: Request) {
  const required = process.env.JOB_SECRET;
  if (required) {
    const got = req.headers.get("x-job-secret");
    if (!got || got !== required) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncAndProcessFinishedMatches({
    maxMatches: 50,
    lookbackHours: 6,
    lookaheadMinutes: 60,
  });

  return NextResponse.json({ ok: true, result });
}
