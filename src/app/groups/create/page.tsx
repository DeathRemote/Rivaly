import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function CreateGroupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/groups/create");

  return (
    <div className="min-h-screen bg-background text-foreground px-6 pt-24 pb-32">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="font-display text-3xl font-black italic tracking-tight text-lime-100">
          Create Group
        </h1>
        <p className="mt-2 text-sm text-white/60">Coming next.</p>
        <div className="mt-6">
          <Link href="/groups" className="text-sm font-bold text-lime-100 hover:underline">
            Back to Groups
          </Link>
        </div>
      </div>
    </div>
  );
}
