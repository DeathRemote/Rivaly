"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type Sport = "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";

type CompetitionSeasonOption = {
  id: string;
  name: string;
  seasonLabel: string;
  sport: Sport;
  country?: string | null;
};

const FALLBACK_COMPETITIONS: Record<Sport, string[]> = {
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
  onChange: (competitionSeasonId: string) => void;
  error?: string;
}) {
  const [options, setOptions] = useState<CompetitionSeasonOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fallbackOptions = sport ? FALLBACK_COMPETITIONS[sport] : [];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sport) {
        setOptions([]);
        return;
      }

      // For now, only soccer competitions are backed by canonical seasons.
      if (sport !== "SOCCER") {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/competition-seasons?sport=${sport}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok) setOptions(json.seasons as CompetitionSeasonOption[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sport]);

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
            {!sport
              ? "Pick a sport first"
              : sport === "SOCCER"
                ? loading
                  ? "Loading competitions…"
                  : "Select competition"
                : "Select competition"}
          </option>

          {sport === "SOCCER"
            ? options.map((s) => (
                <option key={s.id} value={s.id} className="bg-black">
                  {s.name} {s.seasonLabel}
                </option>
              ))
            : fallbackOptions.map((c) => (
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
