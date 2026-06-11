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
      bucket: z.enum(["kickoff", "upcoming", "completed"]),
      limit: z.coerce.number().int().positive().max(200).optional(),
      cursorKickoffAt: z.string().optional(),
      cursorId: z.string().optional(),
    })
    .safeParse({
      bucket: searchParams.get("bucket"),
      limit: searchParams.get("limit") ?? undefined,
      cursorKickoffAt: searchParams.get("cursorKickoffAt") ?? undefined,
      cursorId: searchParams.get("cursorId") ?? undefined,
    });

  if (!parsed.success) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });

  const url = new URL(`${backendBase}/api/internal/groups/${encodeURIComponent(groupId)}/matches`);
  url.searchParams.set("bucket", parsed.data.bucket);
  if (parsed.data.limit) url.searchParams.set("limit", String(parsed.data.limit));
  if (parsed.data.cursorKickoffAt) url.searchParams.set("cursorKickoffAt", parsed.data.cursorKickoffAt);
  if (parsed.data.cursorId) url.searchParams.set("cursorId", parsed.data.cursorId);

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
