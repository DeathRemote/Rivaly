import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/settings");

  return (
    <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 p-6">
        <h1 className="font-display text-3xl font-black italic tracking-tight text-lime-100">
          Settings
        </h1>
        <p className="mt-2 text-sm text-white/60">
          This page is coming next. We&apos;ll add profile edits (username, country) and account
          settings here.
        </p>
      </div>
    </div>
  );
}
