import { cn } from "@/lib/cn";

export type GroupMatch = {
  id: string;
  timeLabel: string;
  venueLabel?: string;
  left: { name: string };
  right: { name: string };
};

export function GroupMatchCard({ match }: { match: GroupMatch }) {
  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-300/10 blur-[90px]" />

      <div className="flex items-start justify-between mb-6">
        <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">
          {match.timeLabel}
        </span>
        <div className="flex -space-x-2 text-[10px] font-black">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20">
            6k
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20">
            12k
          </div>
        </div>
      </div>

      <div className="mb-8 flex items-center justify-between gap-4">
        <Team name={match.left.name} tone="lime" />
        <div className="flex flex-col items-center">
          <div className="font-display text-2xl font-black italic tracking-tighter text-white/20">
            VS
          </div>
          {match.venueLabel ? (
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              {match.venueLabel}
            </div>
          ) : null}
        </div>
        <Team name={match.right.name} tone="cyan" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Pick label="Home" value="Win" />
        <Pick label="Draw" value="Draw" />
        <Pick label="Away" value="Win" />
      </div>

      <button
        type="button"
        className={cn(
          "mt-6 w-full rounded-2xl bg-orange-300 py-4",
          "text-xs font-black uppercase tracking-[0.22em] text-black",
          "shadow-lg shadow-orange-300/10 transition hover:scale-[1.01] active:scale-[0.99]",
        )}
      >
        Predict Now
      </button>
    </article>
  );
}

function Team({ name, tone }: { name: string; tone: "lime" | "cyan" }) {
  const badge = tone === "lime" ? "text-lime-100" : "text-cyan-200";
  return (
    <div className="flex-1 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
        <div className={cn("h-10 w-10 rounded-xl bg-white/5", badge)} />
      </div>
      <div className="font-display text-sm font-black italic text-white">{name}</div>
    </div>
  );
}

function Pick({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="rounded-xl border border-white/10 bg-black/20 py-3 text-center transition hover:bg-white/5"
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40 mb-1">
        {label}
      </div>
      <div className="font-display font-black text-orange-200">{value}</div>
    </button>
  );
}
