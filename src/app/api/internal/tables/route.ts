import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getTablesForSeason } from "@/lib/tables-data";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const parsed = z
    .object({ seasonId: z.string().min(1) })
    .safeParse({ seasonId: searchParams.get("seasonId") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing seasonId" }, { status: 400 });
  }

  try {
    const payload = await getTablesForSeason(userId, parsed.data.seasonId);

    const res = NextResponse.json(payload);
    // UI-level cache: safe as private; shared caching isn't correct because this is user-auth.
    res.headers.set("Cache-Control", "private, max-age=30");
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tables temporarily unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
