import { NextResponse } from "next/server";

import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

export async function POST(req: Request) {
  // Optional shared secret to protect the job endpoint.
  const required = process.env.JOB_SECRET;
  if (required) {
    const got = req.headers.get("x-job-secret");
    if (!got || got !== required) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncAndProcessFinishedMatches({ maxMatches: 25 });
  return NextResponse.json({ ok: true, result });
}
