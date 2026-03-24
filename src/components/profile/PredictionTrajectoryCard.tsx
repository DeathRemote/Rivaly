"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type RangeKey = "d7" | "d14" | "d30";

export type Trajectory = {
  days: number;
  points: number;
  accuracyPct: number;
  series: Array<{ day: string; points: number; correct: number; total: number }>;
};

export function PredictionTrajectoryCard({
  trajectory,
}: {
  trajectory: Record<RangeKey, Trajectory>;
}) {
  const [range, setRange] = useState<RangeKey>("d30");

  const data = trajectory[range];

  const maxPoints = useMemo(() => {
    const m = Math.max(1, ...data.series.map((d) => d.points));
    return m;
  }, [data.series]);

  return (
    <Card className="bg-black/25 p-8 space-y-7">
      <div className="flex justify-between items-end gap-6 flex-wrap">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Performance over time
          </span>
          <h3 className="font-display text-2xl font-black text-white tracking-tight">
            Prediction Trajectory
          </h3>
        </div>

        <div className="flex gap-2">
          <RangeButton active={range === "d7"} onClick={() => setRange("d7")}>7D</RangeButton>
          <RangeButton active={range === "d14"} onClick={() => setRange("d14")}>14D</RangeButton>
          <RangeButton active={range === "d30"} onClick={() => setRange("d30")}>30D</RangeButton>
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Points
          </div>
          <div className="font-display text-3xl font-black text-lime-100">
            {data.points.toLocaleString()} pts
          </div>
        </div>
        <div className="text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            Accuracy
          </div>
          <div className="font-display text-3xl font-black text-white">
            {data.accuracyPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="relative h-56 w-full flex items-end justify-between gap-1">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="border-t border-white/10 w-full" />
          ))}
        </div>

        {data.series.map((d) => {
          const h = Math.round((d.points / maxPoints) * 100);
          const active = d.points === maxPoints && maxPoints > 0;
          return (
            <div
              key={d.day}
              className={cn(
                "w-full rounded-t-lg transition-all cursor-pointer",
                active
                  ? "bg-lime-300 shadow-[0_0_15px_rgba(202,253,0,0.25)]"
                  : "bg-lime-300/15 hover:bg-lime-300/25",
              )}
              style={{ height: `${Math.max(6, h)}%` }}
              title={`${d.day}: ${d.points} pts (${d.correct}/${d.total} correct)`}
            />
          );
        })}
      </div>

      <div className="flex justify-between px-2">
        <span className="text-[9px] font-black uppercase text-white/35">
          {labelLeft(data.series)}
        </span>
        <span className="text-[9px] font-black uppercase text-white/35">
          {labelMid(data.series)}
        </span>
        <span className="text-[9px] font-black uppercase text-white/35">
          {labelRight(data.series)}
        </span>
      </div>
    </Card>
  );
}

function RangeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-[10px] font-black uppercase rounded-md",
        active ? "bg-lime-300 text-black" : "bg-white/5 text-white hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function labelLeft(series: Array<{ day: string }>) {
  return series[0]?.day.slice(5) ?? "";
}
function labelMid(series: Array<{ day: string }>) {
  if (series.length < 3) return "";
  return series[Math.floor(series.length / 2)]?.day.slice(5) ?? "";
}
function labelRight(series: Array<{ day: string }>) {
  return series[series.length - 1]?.day.slice(5) ?? "";
}
