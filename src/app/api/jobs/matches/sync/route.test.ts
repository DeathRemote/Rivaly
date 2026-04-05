import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the pipeline so the route test does not touch the DB or external providers.
vi.mock("@/lib/pipeline/post-match", () => {
  return {
    syncAndProcessFinishedMatches: vi.fn(async () => ({
      skipped: true,
      scanned: 0,
      processed: [],
    })),
  };
});

import { GET } from "@/app/api/jobs/matches/sync/route";
import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

describe("/api/jobs/matches/sync", () => {
  const prevJobSecret = process.env.JOB_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOB_SECRET = "s3cr3t";
  });

  afterEach(() => {
    process.env.JOB_SECRET = prevJobSecret;
  });

  it("rejects without auth", async () => {
    const req = new Request("http://localhost/api/jobs/matches/sync");

    const res = await GET(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "Unauthorized" });
    expect(syncAndProcessFinishedMatches).not.toHaveBeenCalled();
  });

  it("accepts ?token=... (vercel cron compatible) and runs the job", async () => {
    const req = new Request("http://localhost/api/jobs/matches/sync?token=s3cr3t");

    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toMatchObject({ ok: true, auth: "secret" });
    expect(syncAndProcessFinishedMatches).toHaveBeenCalledTimes(1);
  });
});
