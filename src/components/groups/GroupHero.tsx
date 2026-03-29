import { cn } from "@/lib/cn";

export type GroupHeroData = {
  name: string;
  competition: string;
  sportLabel: string;
  memberCount: number;
  description?: string | null;
  userStats?: {
    points: number;
    accuracyPct: number;
  };
};

export function GroupHero({
  group,
  onInvite,
  onPredict,
}: {
  group: GroupHeroData;
  onInvite?: React.ReactNode;
  onPredict?: React.ReactNode;
}) {
  return (
    <header className="relative mb-6 md:mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-8 md:p-10">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-lime-300/10 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-[120px]" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-orange-300/10 blur-[120px]" />

      <div className="relative flex flex-col items-start justify-between gap-4 md:gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-2 md:gap-3">
            <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">
              {group.competition}
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-white/50">
              <span aria-hidden className="text-white/30">
                •
              </span>
              {group.memberCount.toLocaleString()} Members
              <span aria-hidden className="text-white/30">
                •
              </span>
              {group.sportLabel}
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter text-white">
            {group.name}
          </h1>
          <p className="mt-2 md:mt-3 max-w-2xl text-sm font-medium text-white/60">
            {group.description ||
              "High-stakes predictions arena. Compete with your squad and climb the board."}
          </p>

          {group.userStats ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                Your points: {group.userStats.points.toLocaleString()}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                Accuracy: {group.userStats.accuracyPct}%
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:gap-3 sm:w-auto sm:flex-row">
          {onInvite ?? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl",
                "border border-white/10 bg-black/20 px-6 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-white/80",
                "transition hover:bg-white/5 hover:text-lime-100",
              )}
            >
              Invite Friends
            </button>
          )}

          {onPredict ?? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-xl",
                "bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-7 py-3",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "shadow-[0_0_20px_rgba(202,253,0,0.25)]",
                "transition hover:shadow-[0_0_30px_rgba(202,253,0,0.4)] active:scale-[0.99]",
              )}
            >
              Make Predictions
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
