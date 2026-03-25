"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";

type TableRow = {
  teamId: string;
  teamName: string;
  position: number;
  played: number;
  goalDifference: number;
  points: number;
};

export type TablesPageTable = {
  seasonId: string;
  title: string;
  rows: TableRow[];
};

export function TablesPageClient({ tables }: { tables: TablesPageTable[] }) {
  const options = useMemo(() => tables.map((t) => ({ id: t.seasonId, label: t.title })), [tables]);
  const [activeId, setActiveId] = useState<string>(options[0]?.id ?? "");

  const active = useMemo(() => tables.find((t) => t.seasonId === activeId) ?? tables[0], [tables, activeId]);

  if (!tables.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        No tables available yet.
      </div>
    );
  }

  const useSelect = options.length > 4;

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
          Tables
        </div>
        <h1 className="mt-2 font-display text-4xl font-black italic tracking-tight text-white">
          League Tables
        </h1>
        <p className="mt-2 text-sm font-medium text-white/60">
          Tables are shown only for leagues tied to your groups.
        </p>
      </div>

      {/* Switcher */}
      <div className="mb-6">
        {useSelect ? (
          <label className="block">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
              Select competition
            </div>
            <select
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
              className={cn(
                "h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4",
                "text-sm font-semibold text-white",
                "focus:outline-none focus:ring-2 focus:ring-lime-300/40",
              )}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id} className="bg-black">
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
            {options.map((o) => {
              const isActive = o.id === activeId;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveId(o.id)}
                  className={cn(
                    "rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition",
                    isActive
                      ? "bg-lime-300 text-black"
                      : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active table */}
      {active ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                Competition
              </div>
              <h2 className="mt-1 font-display text-2xl font-black italic tracking-tight text-white">
                {active.title}
              </h2>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
              {active.rows.length} teams
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 pr-3">P</th>
                  <th className="py-2 pr-3">GD</th>
                  <th className="py-2">Pts</th>
                </tr>
              </thead>
              <tbody className="text-sm text-white/70">
                {active.rows.map((r) => (
                  <tr key={r.teamId} className="border-t border-white/10">
                    <td className="py-2 pr-3 tabular-nums text-white/45">{r.position}</td>
                    <td className="py-2 pr-3 font-semibold text-white/80">{r.teamName}</td>
                    <td className="py-2 pr-3 tabular-nums text-white/55">{r.played}</td>
                    <td className="py-2 pr-3 tabular-nums text-white/55">{r.goalDifference}</td>
                    <td className="py-2 tabular-nums font-bold text-lime-100">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
