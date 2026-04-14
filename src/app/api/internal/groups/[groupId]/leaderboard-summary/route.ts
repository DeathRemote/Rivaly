import { NextResponse } from "next/server";

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
  const bearer = await signBackendUserToken({ userId, secret: backendSecret });

  const url = `${backendBase}/api/internal/groups/${encodeURIComponent(groupId)}/leaderboard-summary`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
