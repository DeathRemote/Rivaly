import { cn } from "@/lib/cn";

export function MatchesEmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-[110px]" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-orange-300/10 blur-[110px]" />

      <div className="relative mx-auto max-w-lg">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">
          Match Center
        </div>
        <h2 className="font-display text-3xl font-black italic tracking-tight text-lime-100">
          {title}
        </h2>
        <p className="mt-3 text-sm font-medium text-white/60">{subtitle}</p>

        <div className="mt-8 inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className={cn("text-xs font-black uppercase tracking-[0.22em] text-white/60")}>
            We’ll surface fixtures as soon as they’re available.
          </span>
        </div>
      </div>
    </div>
  );
}
