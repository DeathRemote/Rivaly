import { redirect } from "next/navigation";

import type { Session } from "next-auth";

import { auth } from "@/auth";

// NextAuth v5 `auth` is overloaded (middleware + server helper). We only use the server helper shape here.
export type AdminSession = Session | null;

export async function getIsAdmin(): Promise<{ session: AdminSession; isAdmin: boolean }> {
  const session = await auth();
  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session?.user?.email && session.user.email === ownerEmail);
  const isAdmin = Boolean(session?.user && (isOwner || session.user.role === "ADMIN"));
  return { session, isAdmin };
}

/** Server component helper: requires admin; redirects non-authed to login and non-admin to /dashboard. */
export async function requireAdminPageAccess(
  opts?: { callbackUrl?: string },
): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const { session, isAdmin } = await getIsAdmin();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(opts?.callbackUrl ?? "/admin")}`);
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // After the redirect guards above, session.user is guaranteed.
  return session as Session & { user: NonNullable<Session["user"]> };
}

