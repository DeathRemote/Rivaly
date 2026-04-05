import { describe, expect, it, vi } from "vitest";

import { requireJobAuth } from "@/lib/jobs/auth";

vi.mock("@/lib/admin/api-auth", () => {
  return {
    requireAdminApi: vi.fn(async () => ({ ok: false, response: null })),
  };
});

describe("requireJobAuth", () => {
  it("accepts x-job-secret header", async () => {
    process.env.JOB_SECRET = "s3cr3t";

    const req = new Request("http://localhost/api/jobs/x", {
      headers: { "x-job-secret": "s3cr3t" },
    });

    const res = await requireJobAuth(req);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mode).toBe("secret");
  });

  it("accepts Authorization Bearer", async () => {
    process.env.JOB_SECRET = "s3cr3t";

    const req = new Request("http://localhost/api/jobs/x", {
      headers: { authorization: "Bearer s3cr3t" },
    });

    const res = await requireJobAuth(req);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mode).toBe("secret");
  });

  it("accepts ?token= query param (for cron)", async () => {
    process.env.JOB_SECRET = "s3cr3t";

    const req = new Request("http://localhost/api/jobs/x?token=s3cr3t");

    const res = await requireJobAuth(req);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mode).toBe("secret");
  });

  it("rejects when secret does not match", async () => {
    process.env.JOB_SECRET = "s3cr3t";

    const req = new Request("http://localhost/api/jobs/x?token=wrong");

    const res = await requireJobAuth(req);
    expect(res.ok).toBe(false);
  });
});
