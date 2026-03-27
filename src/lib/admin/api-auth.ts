import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function requireAdminApi() {
  const session = await auth();
  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session?.user?.email && session.user.email === ownerEmail);
  const isAdmin = Boolean(session?.user && (isOwner || session.user.role === "ADMIN"));

  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdmin) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, session };
}
