import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";

export async function GET(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) return NextResponse.json({ error: "Backend not configured" }, { status: 500 });

  const { groupId } = await ctx.params;
  const { searchParams } = new URL(req.url);

  const parsed = z
    .object({
      limit: z.coerce.number().int().positive().max(50).optional(),
      cursorPoints: z.coerce.number().int().optional(),
      cursorUserId: z.string().optional(),
    })
    .safeParse({
      limit: searchParams.get("limit") ?? undefined,
      cursorPoints: searchParams.get("cursorPoints") ?? undefined,
      cursorUserId: searchParams.get("cursorUserId") ?? undefined,
    });

  if (!parsed.success) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });

  const url = new URL(`${backendBase}/api/internal/groups/${encodeURIComponent(groupId)}/leaderboard`);
  if (parsed.data.limit) url.searchParams.set("limit", String(parsed.data.limit));
  if (parsed.data.cursorPoints != null) url.searchParams.set("cursorPoints", String(parsed.data.cursorPoints));
  if (parsed.data.cursorUserId) url.searchParams.set("cursorUserId", parsed.data.cursorUserId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
