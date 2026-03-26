"use client";

import { cn } from "@/lib/cn";

import { useEffect, useMemo, useState } from "react";

type Sport = "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";

const SPORT_OPTIONS: Array<{ key: Sport; label: string; emoji: string }> = [
  { key: "SOCCER", label: "Football", emoji: "⚽" },
  { key: "BASKETBALL", label: "Basketball", emoji: "🏀" },
  { key: "TENNIS", label: "Tennis", emoji: "🎾" },
  { key: "ESPORTS", label: "Esports", emoji: "🎮" },
];

export function SportSelector({
  value,
  onChange,
  error,
}: {
  value: Sport | "";
  onChange: (sport: Sport) => void;
  error?: string;
}) {
  const [enabledSports, setEnabledSports] = useState<Sport[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sports", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.ok && Array.isArray(json.sports)) {
          setEnabledSports(json.sports as Sport[]);
        }
      } catch {
        // If the endpoint fails for any reason, fall back to showing all options.
        if (!cancelled) setEnabledSports(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    if (!enabledSports) return SPORT_OPTIONS;
    const set = new Set(enabledSports);
    return SPORT_OPTIONS.filter((o) => set.has(o.key));
  }, [enabledSports]);

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
        Select discipline
      </label>

      {options.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No sports are currently enabled.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={cn(
                "rounded-xl p-4 text-left transition active:scale-[0.99]",
                active
                  ? "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]"
                  : "bg-white/5 text-white/70 hover:bg-white/10",
                "border border-white/10",
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={cn("text-2xl", active ? "" : "opacity-80")}>{opt.emoji}</div>
                <div className={cn("text-[10px] font-black uppercase tracking-[0.18em]", active ? "" : "text-white/60")}>
                  {opt.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-[#ff7351]">{error}</p> : null}
    </div>
  );
}
