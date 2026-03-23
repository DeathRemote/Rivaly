import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/50 hover:text-lime-100"
        >
          <span aria-hidden>‹</span>
          Back to landing
        </a>
        <AuthCard callbackUrl={callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  );
}
