import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";

/**
 * Job endpoints should be callable from cron without a user session.
 *
 * Auth options:
 * 1) x-job-secret header (or Authorization: Bearer) matching env JOB_SECRET
 * 2) Admin session (fallback for manual triggering in-browser)
 */
export async function requireJobAuth(req: Request) {
  const configured = process.env.JOB_SECRET;

  // Vercel Cron cannot set headers; it often calls GET.
  // Support `?token=...` for cron/manual curl.
  const urlToken = (() => {
    try {
      const url = new URL(req.url);
      return url.searchParams.get("token");
    } catch {
      return null;
    }
  })();

  const headerSecret =
    req.headers.get("x-job-secret") ||
    (() => {
      const auth = req.headers.get("authorization") || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      return m?.[1] ?? null;
    })();

  const presented = urlToken || headerSecret;

  if (configured && presented && presented === configured) {
    return { ok: true as const, mode: "secret" as const };
  }

  // Allow admins to trigger from the app.
  const admin = await requireAdminApi();
  if (admin.ok) return { ok: true as const, mode: "admin" as const };

  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
  };
}
