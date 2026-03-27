import { NextResponse } from "next/server";

import { getSportConfigsCached } from "@/lib/admin/sports";

export async function GET() {
  const rows = await getSportConfigsCached();
  return NextResponse.json({
    ok: true,
    sports: rows.filter((r) => r.enabled).map((r) => r.sport),
  });
}
