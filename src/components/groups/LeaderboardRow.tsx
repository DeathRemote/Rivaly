import { cn } from "@/lib/cn";

export type LeaderboardRowData = {
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
        "grid grid-cols-12 items-center px-6 py-4 transition",
        row.isYou
          ? "mx-1 rounded-2xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00] shadow-lg scale-[1.01]"
          : "hover:bg-white/5",
        !row.isYou && "opacity-90",
      )}
    >
      <div
        className={cn(
          "col-span-1 font-display text-xl font-black italic",
          row.rank <= 3 ? "text-lime-200" : row.isYou ? "text-[#3a4a00]" : "text-white/40",
        )}
      >
        {String(row.rank).padStart(2, "0")}
      </div>

      <div className="col-span-5 flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-full border border-white/10 bg-black/20",
            row.isYou && "border-[#3a4a00]/30 bg-[#3a4a00]/10",
          )}
        />
        <div>
          <div className={cn("text-sm font-black", row.isYou ? "text-[#3a4a00]" : "text-white")}>
            {row.isYou ? `You (${row.name})` : row.name}
          </div>
          <div className={cn("text-[10px] font-black uppercase tracking-[0.22em]", row.isYou ? "text-[#3a4a00]/60" : "text-lime-200/40")}>
            {row.rank <= 10 ? "Master Elite" : "Gold Tier"}
          </div>
        </div>
      </div>

      <div className="col-span-2 text-right font-display text-lg font-black">
        {row.points.toLocaleString()}
      </div>
      <div
        className={cn(
          "col-span-2 text-right font-display text-lg font-black",
          row.isYou ? "text-[#3a4a00]" : "text-lime-200",
        )}
      >
        {row.accuracyPct}%
      </div>
      <div className="col-span-2 flex justify-center">
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
