import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.user.email && session.user.email === ownerEmail);
  const isAdmin = isOwner || session.user.role === "ADMIN";

  if (!isAdmin) {
    // Backend protection: do not render admin for non-admin users.
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl font-black italic tracking-tight text-white">
        Admin
      </h1>
      <p className="mt-4 text-white/60">Admin tools coming soon.</p>
    </div>
  );
}
