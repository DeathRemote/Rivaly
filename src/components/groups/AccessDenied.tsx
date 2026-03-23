import Link from "next/link";

import { cn } from "@/lib/cn";

export function AccessDenied({
  title = "Access denied",
  message = "You’re not a member of this group.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
        Rivaly
      </div>
      <h1 className="mt-3 font-display text-3xl font-black italic tracking-tight text-lime-100">
        {title}
      </h1>
      <p className="mt-3 text-sm font-medium text-white/60">{message}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/groups"
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-6 py-3",
            "text-xs font-black uppercase tracking-[0.22em] text-white/80",
            "transition hover:bg-white/5 hover:text-lime-100",
          )}
        >
          Back to Groups
        </Link>
      </div>
    </div>
  );
}
