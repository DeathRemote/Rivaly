import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getAdminStatsCached } from "@/lib/admin/stats";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const stats = await getAdminStatsCached();
  return NextResponse.json({ ok: true, stats });
}
