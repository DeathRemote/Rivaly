"use client";

import { useEffect, useRef, useState } from "react";

import type { TablesPayload } from "@/lib/tables-data";

import { StandingsMiniTable } from "@/components/tables/StandingsMiniTable";

type State = {
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

export function GroupStageTablesTabClient({ seasonId }: { seasonId: string }) {
  const cacheRef = useRef(new Map<string, TablesPayload>());
  const [state, setState] = useState<State>({ loading: true, error: null, data: null });

  useEffect(() => {
    if (!seasonId) return;

    const cached = cacheRef.current.get(seasonId);
    if (cached) {
      setState({ loading: false, error: null, data: cached });
      return;
    }

    let alive = true;
    setState({ loading: true, error: null, data: null });

    (async () => {
      try {
        const res = await fetch(`/api/internal/tables?seasonId=${encodeURIComponent(seasonId)}`);
        if (!res.ok) throw new Error(await res.text());

        const data = (await res.json()) as TablesPayload;
        cacheRef.current.set(seasonId, data);

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
  }, [seasonId]);

  if (state.loading) return <Spinner label="Loading tables..." />;

  if (state.error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        Tables are temporarily unavailable. Please try again.
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">No tables available yet.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Groups (match /tables UI) */}
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
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">No group tables available yet.</div>
      )}
    </div>
  );
}
