import { redirect } from "next/navigation";

import { auth } from "@/auth";

export type AdminSession = Awaited<ReturnType<typeof auth>>;

export async function getIsAdmin(): Promise<{ session: AdminSession; isAdmin: boolean }> {
  const session = await auth();
  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session?.user?.email && session.user.email === ownerEmail);
  const isAdmin = Boolean(session?.user && (isOwner || session.user.role === "ADMIN"));
  return { session, isAdmin };
}

/** Server component helper: requires admin; redirects non-authed to login and non-admin to /dashboard. */
export async function requireAdminPageAccess(opts?: { callbackUrl?: string }) {
  const { session, isAdmin } = await getIsAdmin();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(opts?.callbackUrl ?? "/admin")}`);
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return session;
}
