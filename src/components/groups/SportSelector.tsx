"use client";

import { cn } from "@/lib/cn";

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
  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
        Select discipline
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SPORT_OPTIONS.map((opt) => {
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
