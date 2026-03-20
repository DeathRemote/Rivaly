import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
    />
  );
}
