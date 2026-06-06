"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { StandingsMiniTable } from "@/components/tables/StandingsMiniTable";

import type { TablesPayload, TablesSeasonOption } from "@/lib/tables-data";

type TablesPageState = {
  loading: boolean;
  error: string | null;
  data: TablesPayload | null;
};

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
      <div className="text-sm font-semibold">{label ?? "Loading..."}</div>
    </div>
  );
}

export function TablesPageClient({
  seasons,
  error,
}: {
  seasons: TablesSeasonOption[];
  error?: string | null;
}) {
  const options = useMemo(() => seasons.map((s) => ({ id: s.seasonId, label: s.title })), [seasons]);
  const [activeId, setActiveId] = useState<string>(options[0]?.id ?? "");

  // Keep activeId in sync when seasons load/change.
  useEffect(() => {
    if (!activeId && options[0]?.id) setActiveId(options[0].id);
  }, [activeId, options]);

  const cacheRef = useRef(new Map<string, TablesPayload>());
  const [state, setState] = useState<TablesPageState>({
    loading: Boolean(activeId),
    error: null,
    data: null,
  });

  useEffect(() => {
    if (!activeId) return;

    const cached = cacheRef.current.get(activeId);
    if (cached) {
      setState({ loading: false, error: null, data: cached });
      return;
    }

    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const res = await fetch(`/api/internal/tables?seasonId=${encodeURIComponent(activeId)}`);
        if (!res.ok) throw new Error(await res.text());

        const data = (await res.json()) as TablesPayload;
        cacheRef.current.set(activeId, data);

        if (!alive) return;
        setState({ loading: false, error: null, data });
      } catch (e) {
        if (!alive) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : "Tables temporarily unavailable.",
          data: null,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeId]);

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        Tables are temporarily unavailable. Please try again.
      </div>
    );
  }

  if (!options.length) {
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
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">Tables</div>
        <h1 className="mt-2 font-display text-4xl font-black italic tracking-tight text-white">Tables</h1>
        <p className="mt-2 text-sm font-medium text-white/60">
          League tables and group-stage tables are shown only for competitions tied to your groups.
        </p>
      </div>

      {/* Switcher */}
      <div className="mb-6">
        {useSelect ? (
          <label className="block">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Select competition</div>
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
                    isActive ? "bg-lime-300 text-black" : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {state.loading ? <Spinner label="Loading tables..." /> : null}

      {!state.loading && state.error ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
          Tables are temporarily unavailable. Please try again.
        </div>
      ) : null}

      {!state.loading && !state.error && state.data ? (
        <div className="space-y-6">
          {/* League */}
          {state.data.league?.rows?.length ? (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Competition</div>
                  <h2 className="mt-1 font-display text-2xl font-black italic tracking-tight text-white">
                    {state.data.title}
                  </h2>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">League table</div>
              </div>

              <StandingsMiniTable rows={state.data.league.rows} />
            </section>
          ) : null}

          {/* Groups */}
          {state.data.groups?.length ? (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Group stage</div>
                  <h3 className="mt-1 font-display text-xl font-black italic tracking-tight text-white">Groups</h3>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  {state.data.groups.length} groups
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {state.data.groups.map((g) => (
                  <div key={g.competitionGroupId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{g.name}</div>
                    {g.rows.length ? (
                      <StandingsMiniTable rows={g.rows} />
                    ) : (
                      <div className="mt-3 text-sm font-medium text-white/55">No matches yet.</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!state.data.league?.rows?.length && !state.data.groups?.length ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">No tables available yet.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
