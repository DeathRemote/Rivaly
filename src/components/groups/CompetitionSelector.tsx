"use client";

import { cn } from "@/lib/cn";

type Sport = "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";

const COMPETITIONS: Record<Sport, string[]> = {
  SOCCER: ["Premier League", "Champions League", "La Liga", "Serie A", "Bundesliga"],
  BASKETBALL: ["NBA", "EuroLeague"],
  TENNIS: ["ATP", "WTA", "Grand Slams"],
  ESPORTS: ["LoL", "CS2", "Valorant"],
};

export function CompetitionSelector({
  sport,
  value,
  onChange,
  error,
}: {
  sport: Sport | "";
  value: string;
  onChange: (competition: string) => void;
  error?: string;
}) {
  const options = sport ? COMPETITIONS[sport] : [];

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
        Target competition
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!sport}
          className={cn(
            "h-12 w-full appearance-none rounded-xl bg-black/30 px-4 text-sm font-bold text-white",
            "border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-300/30",
            !sport && "opacity-50",
          )}
        >
          <option value="" disabled>
            {sport ? "Select competition" : "Pick a sport first"}
          </option>
          {options.map((c) => (
            <option key={c} value={c} className="bg-black">
              {c}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
          ▾
        </span>
      </div>

      {error ? <p className="text-sm text-[#ff7351]">{error}</p> : null}
    </div>
  );
}
