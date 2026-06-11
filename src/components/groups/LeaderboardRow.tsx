import { cn } from "@/lib/cn";

export type LeaderboardRowData = {
  userId: string;
  rank: number;
  name: string;
  points: number;
  accuracyPct: number;
  trend: "up" | "down" | "flat";
  isYou?: boolean;
};

export function LeaderboardRow({ row }: { row: LeaderboardRowData }) {
  return (
    <div
      className={cn(
        // Mobile: 3 columns (rank | name | stats). Desktop: 12-col grid.
        "grid grid-cols-[48px_1fr_auto] sm:grid-cols-12 items-center px-4 sm:px-6 py-3 sm:py-4 transition",
        row.isYou
          ? "mx-1 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] shadow-lg scale-[1.01]"
          : "hover:bg-white/5",
        !row.isYou && "opacity-90",
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          "font-display text-lg sm:text-xl font-black italic",
          "sm:col-span-1",
          row.isYou
            ? "text-[#1e2600]"
            : row.rank <= 3
              ? "text-lime-200"
              : "text-white/40",
        )}
      >
        {String(row.rank).padStart(2, "0")}
      </div>

      {/* Name + tier */}
      <div className="min-w-0 sm:col-span-5 flex items-center gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "text-sm font-black",
              "truncate",
              row.isYou ? "text-[#3a4a00]" : "text-white",
            )}
            title={row.name}
          >
            {row.isYou ? `You (${row.name})` : row.name}
          </div>
          <div
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.22em]",
              row.isYou ? "text-[#3a4a00]/60" : "text-lime-200/40",
            )}
          >
            {row.rank <= 10 ? "Master Elite" : "Gold Tier"}
          </div>
        </div>
      </div>

      {/* Stats (mobile stacked, desktop split columns) */}
      <div className="flex items-center gap-4 sm:hidden">
        <div className="flex items-baseline gap-3 text-right font-display text-base font-black tabular-nums">
          <span>{row.points.toLocaleString()}</span>
          <span className={cn(row.isYou ? "text-[#3a4a00]" : "text-lime-200")}>{row.accuracyPct}%</span>
        </div>
        <span
          className={cn(
            "text-sm font-black",
            row.trend === "up" ? "text-lime-200" : row.trend === "down" ? "text-orange-300" : "text-white/40",
            row.isYou && "text-[#3a4a00]",
          )}
        >
          {row.trend === "up" ? "↗" : row.trend === "down" ? "↘" : "—"}
        </span>
      </div>

      {/* Desktop columns */}
      <div className="hidden sm:block sm:col-span-2 text-right font-display text-lg font-black tabular-nums">
        {row.points.toLocaleString()}
      </div>
      <div
        className={cn(
          "hidden sm:block sm:col-span-2 text-right font-display text-lg font-black tabular-nums",
          row.isYou ? "text-[#3a4a00]" : "text-lime-200",
        )}
      >
        {row.accuracyPct}%
      </div>
      <div className="hidden sm:flex sm:col-span-2 justify-center">
        <span
          className={cn(
            "text-sm font-black",
            row.trend === "up" ? "text-lime-200" : row.trend === "down" ? "text-orange-300" : "text-white/40",
            row.isYou && "text-[#3a4a00]",
          )}
        >
          {row.trend === "up" ? "↗" : row.trend === "down" ? "↘" : "—"}
        </span>
      </div>
    </div>
  );
}
