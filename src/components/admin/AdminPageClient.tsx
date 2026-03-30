"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Sport } from "@prisma/client";

import { cn } from "@/lib/cn";
import type { AdminStats } from "@/lib/admin/stats";
import type { SportConfigRow } from "@/lib/admin/sports";
import type { AdminCompetition } from "@/lib/admin/catalog";

function formatCurrencyFromCents(cents: number) {
  const dollars = cents / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(dollars);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
        {label}
      </div>
      <div className="mt-3 font-display text-4xl font-black italic tracking-tight text-lime-100">
        {value}
      </div>
      {hint ? <div className="mt-3 text-sm text-white/50">{hint}</div> : null}
    </div>
  );
}

export function AdminPageClient({
  initialStats,
  initialSports,
  initialCatalog,
}: {
  initialStats: AdminStats;
  initialSports: SportConfigRow[];
  initialCatalog: AdminCompetition[];
}) {
  const [stats, setStats] = useState(initialStats);
  const [sports, setSports] = useState(initialSports);
  const [catalog, setCatalog] = useState(initialCatalog);

  const [busy, startTransition] = useTransition();

  const [activeSport, setActiveSport] = useState<Sport>("SOCCER");

  const filteredCompetitions = useMemo(
    () => catalog.filter((c) => c.sport === activeSport),
    [catalog, activeSport],
  );

  const [leagueSearch, setLeagueSearch] = useState("");
  const [leagueResults, setLeagueResults] = useState<
    Array<{ idLeague: string; name: string; alternateName: string | null }>
  >([]);
  const [leagueSearchState, setLeagueSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [selectedLeague, setSelectedLeague] = useState<
    null | { idLeague: string; name: string; alternateName: string | null }
  >(null);

  const [leagueSeasons, setLeagueSeasons] = useState<
    Array<{ seasonLabel: string; providerSeasonId: string | null }>
  >([]);
  const [seasonLabel, setSeasonLabel] = useState("");
  const [seasonProviderId, setSeasonProviderId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState("");
  const [userResult, setUserResult] = useState<
    | null
    | {
        id: string;
        email: string | null;
        name: string | null;
        username: string | null;
        image: string | null;
        role: "USER" | "ADMIN";
        accountTier: "FREE" | "BASIC" | "PRO" | "ELITE" | "FRIENDS_AND_FAMILY";
        createdAt: string;
        updatedAt: string;
      }
  >(null);
  const [userLookupState, setUserLookupState] = useState<"idle" | "loading" | "notfound" | "error">(
    "idle",
  );

  async function refreshStats() {
    const res = await fetch("/api/admin/stats", { cache: "no-store" });
    const json = await res.json();
    if (json?.ok && json.stats) setStats(json.stats as AdminStats);
  }

  async function refreshSportsAndCatalog() {
    const [sportsRes, compsRes] = await Promise.all([
      fetch("/api/admin/sports", { cache: "no-store" }),
      fetch("/api/admin/competitions", { cache: "no-store" }),
    ]);
    const sportsJson = await sportsRes.json();
    const compsJson = await compsRes.json();

    if (sportsJson?.ok && Array.isArray(sportsJson.sports)) {
      setSports(sportsJson.sports as SportConfigRow[]);
    }
    if (compsJson?.ok && Array.isArray(compsJson.competitions)) {
      setCatalog(compsJson.competitions as AdminCompetition[]);
    }
  }

  // Provider-backed league search (debounced)
  // Note: we only enable this for Soccer right now.
  // Avoid hammering the API by waiting briefly after the user stops typing.
  useEffect(() => {
    if (activeSport !== "SOCCER") return;

    const q = leagueSearch.trim();
    if (q.length < 2) return;

    const t = setTimeout(() => {
      setLeagueSearchState("loading");
      fetch(`/api/admin/providers/thesportsdb/leagues/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.results)) {
            setLeagueResults(json.results);
            setLeagueSearchState("idle");
          } else {
            setLeagueSearchState("error");
          }
        })
        .catch(() => setLeagueSearchState("error"));
    }, 450);

    return () => clearTimeout(t);
  }, [leagueSearch, activeSport]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-orange-200/70">
          Platform control
        </span>
        <h1 className="font-display text-4xl font-black italic tracking-tight text-white">
          Admin
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium text-white/60">
          Manage platform health, competitions, and user permissions.
        </p>
      </header>

      {/* Stats */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-black italic text-white">Top metrics</h2>
            <p className="mt-1 text-sm text-white/50">Cached reads (≈30s) to keep load predictable.</p>
          </div>
          <button
            type="button"
            onClick={() => startTransition(refreshStats)}
            className={cn(
              "h-11 rounded-xl border border-white/10 bg-black/20 px-4",
              "text-xs font-black uppercase tracking-[0.22em] text-white/70",
              "hover:bg-white/5 transition",
              busy && "opacity-60 cursor-not-allowed",
            )}
            disabled={busy}
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={new Intl.NumberFormat().format(stats.totalUsers)} />
          <StatCard
            label="Total predictions"
            value={new Intl.NumberFormat().format(stats.totalPredictions)}
          />
          <StatCard
            label="One-time payments (cash)"
            value={formatCurrencyFromCents(stats.totalOneTimePaymentsCents)}
            hint={
              stats.paymentsSource === "placeholder"
                ? "Payments not wired yet — showing placeholder 0. Ready to connect to Stripe/PSP later."
                : undefined
            }
          />
          <StatCard
            label="Monthly payments (cash)"
            value={formatCurrencyFromCents(stats.totalMonthlyPaymentsCents)}
            hint={
              stats.paymentsSource === "placeholder"
                ? "Payments not wired yet — showing placeholder 0."
                : undefined
            }
          />
        </div>

        <div className="text-xs text-white/40">Last computed: {new Date(stats.cachedAt).toLocaleString()}</div>
      </section>

      {/* Sports */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-black italic text-white">Sports activation</h2>
          <p className="mt-1 text-sm text-white/50">
            Controls which sports users can select when creating groups.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5">
          <div className="divide-y divide-white/10">
            {sports.map((s) => (
              <div key={s.sport} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                    {s.sport}
                  </div>
                  <div className="mt-1 text-sm text-white/40">
                    {s.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      const next = !s.enabled;
                      setSports((prev) => prev.map((p) => (p.sport === s.sport ? { ...p, enabled: next } : p)));
                      const res = await fetch("/api/admin/sports", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sport: s.sport, enabled: next }),
                      });
                      if (!res.ok) {
                        // Revert on failure
                        setSports((prev) => prev.map((p) => (p.sport === s.sport ? { ...p, enabled: s.enabled } : p)));
                        return;
                      }
                    });
                  }}
                  disabled={busy}
                  className={cn(
                    "h-10 rounded-xl px-4",
                    s.enabled
                      ? "bg-lime-300/10 text-lime-100 hover:bg-lime-300/15"
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                    "border border-white/10",
                    "text-xs font-black uppercase tracking-[0.22em] transition",
                    busy && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitions */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-black italic text-white">Competitions</h2>
            <p className="mt-1 text-sm text-white/50">
              Uses canonical Competition / CompetitionSeason. Publishing controls what appears in group creation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => startTransition(refreshSportsAndCatalog)}
            className={cn(
              "h-11 rounded-xl border border-white/10 bg-black/20 px-4",
              "text-xs font-black uppercase tracking-[0.22em] text-white/70",
              "hover:bg-white/5 transition",
              busy && "opacity-60 cursor-not-allowed",
            )}
            disabled={busy}
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"] as Sport[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSport(s)}
              className={cn(
                "h-9 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.22em]",
                activeSport === s
                  ? "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Import competition season (API-backed) */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                Import competition season
              </div>
              <div className="mt-1 text-sm text-white/50">
                Soccer imports are provider-backed (TheSportsDB). No free-text competitions.
              </div>
            </div>
            {importMessage ? <div className="text-xs text-white/60">{importMessage}</div> : null}
          </div>

          {activeSport !== "SOCCER" ? (
            <div className="mt-4 text-sm text-white/50">
              Provider-backed import is only implemented for Soccer right now.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <input
                  value={leagueSearch}
                  onChange={(e) => {
                    const next = e.target.value;
                    setImportMessage(null);
                    setLeagueSearch(next);
                    setSelectedLeague(null);
                    setLeagueSeasons([]);
                    setSeasonLabel("");
                    setSeasonProviderId(null);

                    if (next.trim().length < 2) {
                      setLeagueResults([]);
                      setLeagueSearchState("idle");
                    }
                  }}
                  placeholder="Search competition (e.g. Allsvenskan, Premier League…)"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/25"
                />
                {leagueSearchState === "loading" ? (
                  <div className="mt-2 text-xs text-white/40">Searching…</div>
                ) : null}
                {leagueSearchState === "error" ? (
                  <div className="mt-2 text-xs text-[#ffd2c8]">Search failed.</div>
                ) : null}

                {leagueResults.length > 0 && !selectedLeague ? (
                  <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-white/10 bg-black/30">
                    <div className="divide-y divide-white/10">
                      {leagueResults.map((r) => (
                        <button
                          key={r.idLeague}
                          type="button"
                          className={cn(
                            "w-full px-4 py-3 text-left",
                            "hover:bg-white/5 transition",
                          )}
                          onClick={() => {
                            startTransition(async () => {
                              setImportMessage(null);
                              setSelectedLeague(r);
                              setLeagueResults([]);
                              setLeagueSearch(r.name);
                              setSeasonLabel("");
                              setSeasonProviderId(null);
                              setLeagueSeasons([]);

                              const res = await fetch(
                                `/api/admin/providers/thesportsdb/leagues/${encodeURIComponent(r.idLeague)}/seasons`,
                                { cache: "no-store" },
                              );
                              const json = await res.json();
                              if (json?.ok && Array.isArray(json.seasons)) {
                                setLeagueSeasons(json.seasons);
                                if (json.seasons[0]?.seasonLabel) {
                                  setSeasonLabel(json.seasons[0].seasonLabel);
                                  setSeasonProviderId(json.seasons[0].providerSeasonId ?? null);
                                }
                              }
                            });
                          }}
                        >
                          <div className="text-sm font-semibold text-white/80">{r.name}</div>
                          {r.alternateName ? (
                            <div className="mt-1 text-xs text-white/40">aka {r.alternateName}</div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedLeague ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/50">
                    Selected: <span className="text-white/80 font-bold">{selectedLeague.name}</span> · id={selectedLeague.idLeague}
                  </div>
                ) : null}
              </div>

              <div>
                <select
                  value={seasonLabel}
                  disabled={!selectedLeague || leagueSeasons.length === 0}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSeasonLabel(next);
                    const hit = leagueSeasons.find((s) => s.seasonLabel === next);
                    setSeasonProviderId(hit?.providerSeasonId ?? null);
                  }}
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white",
                    !selectedLeague && "opacity-50",
                  )}
                >
                  {leagueSeasons.length === 0 ? (
                    <option value="">Select season…</option>
                  ) : (
                    leagueSeasons.map((s) => (
                      <option key={s.seasonLabel} value={s.seasonLabel}>
                        {s.seasonLabel}
                      </option>
                    ))
                  )}
                </select>
                <div className="mt-2 text-[11px] text-white/35">
                  Missing a season? You can type it below.
                </div>
                <input
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                  disabled={!selectedLeague}
                  placeholder="Or type season label"
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/25 disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  activeSport !== "SOCCER" ||
                  !selectedLeague ||
                  seasonLabel.trim().length < 1
                }
                onClick={() => {
                  startTransition(async () => {
                    const league = selectedLeague;
                    if (!league) {
                      setImportMessage("Select a league first.");
                      return;
                    }

                    setImportMessage("Importing…");
                    const res = await fetch("/api/admin/competition-seasons/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sport: "SOCCER",
                        provider: "THESPORTSDB",
                        providerLeagueId: league.idLeague,
                        seasonLabel: seasonLabel.trim(),
                        providerSeasonId: seasonProviderId ?? undefined,
                        syncMatches: true,
                      }),
                    });

                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) {
                      setImportMessage(json?.error ? `Import failed: ${json.error}` : "Import failed");
                      return;
                    }

                    const fixturesOk = json.fixtures?.ok !== false;
                    setImportMessage(
                      fixturesOk
                        ? "Imported + synced matches."
                        : `Imported, but match sync failed: ${json.fixtures?.error ?? "unknown"}`,
                    );

                    await refreshSportsAndCatalog();
                  });
                }}
                className={cn(
                  "h-11 rounded-xl",
                  "bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                  "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                  "hover:brightness-105 transition",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                Import
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {filteredCompetitions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/60">
              No competitions for {activeSport}.
            </div>
          ) : null}

          {filteredCompetitions.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="font-display text-lg font-black italic text-white">{c.name}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-white/40">
                    {c.country ?? "—"}
                    {c.provider ? ` · ${c.provider}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    startTransition(async () => {
                      const next = !c.published;
                      setCatalog((prev) => prev.map((p) => (p.id === c.id ? { ...p, published: next } : p)));
                      const res = await fetch(`/api/admin/competitions/${c.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ published: next }),
                      });
                      if (!res.ok) {
                        setCatalog((prev) => prev.map((p) => (p.id === c.id ? { ...p, published: c.published } : p)));
                      }
                    });
                  }}
                  className={cn(
                    "h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
                    "border border-white/10 transition",
                    c.published
                      ? "bg-lime-300/10 text-lime-100 hover:bg-lime-300/15"
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                    busy && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {c.published ? "Published" : "Unpublished"}
                </button>
              </div>

              <div className="border-t border-white/10 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/40">
                  Seasons
                </div>

                <div className="mt-3 space-y-2">
                  {c.seasons.length === 0 ? (
                    <div className="text-sm text-white/50">No seasons yet.</div>
                  ) : null}
                  {c.seasons.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4",
                        s.archivedAt && "opacity-60",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                            {s.seasonLabel}
                          </div>
                          {s.archivedAt ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                              Archived
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 text-sm text-white/40">
                          {s.archivedAt
                            ? "Archived (not available for group creation)"
                            : s.published
                              ? "Enabled in group creation"
                              : "Hidden from group creation"}
                        </div>

                        <div className="mt-2 text-[11px] text-white/35">
                          Last synced: {s.fixturesSyncedAt ? new Date(s.fixturesSyncedAt).toLocaleString() : "—"}
                          {s.fixturesSyncError ? (
                            <span className="block mt-1 text-[#ffd2c8]">Sync error: {s.fixturesSyncError}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          type="button"
                          disabled={busy || !!s.archivedAt}
                          onClick={() => {
                            startTransition(async () => {
                              const next = !s.published;
                              setCatalog((prev) =>
                                prev.map((p) =>
                                  p.id !== c.id
                                    ? p
                                    : {
                                        ...p,
                                        seasons: p.seasons.map((ss) => (ss.id === s.id ? { ...ss, published: next } : ss)),
                                      },
                                ),
                              );

                              const res = await fetch(`/api/admin/competition-seasons/${s.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ published: next }),
                              });

                              if (!res.ok) {
                                setCatalog((prev) =>
                                  prev.map((p) =>
                                    p.id !== c.id
                                      ? p
                                      : {
                                          ...p,
                                          seasons: p.seasons.map((ss) => (ss.id === s.id ? { ...ss, published: s.published } : ss)),
                                        },
                                  ),
                                );
                              }
                            });
                          }}
                          className={cn(
                            "h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
                            "border border-white/10 transition",
                            s.published
                              ? "bg-lime-300/10 text-lime-100 hover:bg-lime-300/15"
                              : "bg-white/5 text-white/60 hover:bg-white/10",
                            (busy || s.archivedAt) && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {s.published ? "Enabled" : "Disabled"}
                        </button>

                        <button
                          type="button"
                          disabled={busy || !!s.archivedAt}
                          onClick={() => {
                            startTransition(async () => {
                              setImportMessage("Syncing matches…");
                              const res = await fetch(`/api/admin/competition-seasons/${s.id}/sync-matches`, {
                                method: "POST",
                              });
                              const json = await res.json().catch(() => null);
                              if (!res.ok || !json?.ok) {
                                setImportMessage(json?.error ? `Sync failed: ${json.error}` : "Sync failed");
                                await refreshSportsAndCatalog();
                                return;
                              }
                              setImportMessage("Matches synced.");
                              await refreshSportsAndCatalog();
                            });
                          }}
                          className={cn(
                            "h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
                            "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition",
                            (busy || s.archivedAt) && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          Sync matches
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const ok = confirm(
                              "Delete competition season? If it is already in use, it will be archived instead of hard-deleted.",
                            );
                            if (!ok) return;

                            startTransition(async () => {
                              const res = await fetch(`/api/admin/competition-seasons/${s.id}`, {
                                method: "DELETE",
                              });
                              const json = await res.json().catch(() => null);
                              if (!res.ok || !json?.ok) {
                                setImportMessage(json?.error ? `Delete failed: ${json.error}` : "Delete failed");
                                return;
                              }

                              if (json.action === "archived") {
                                setImportMessage(
                                  `Archived instead of deleted (in use). Groups=${json.usage?.groupsCount ?? 0}, Matches=${json.usage?.matchesCount ?? 0}.`,
                                );
                              } else {
                                setImportMessage("Deleted.");
                              }

                              await refreshSportsAndCatalog();
                            });
                          }}
                          className={cn(
                            "h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
                            "border border-[#ff7351]/30 bg-[#d53d18]/10 text-[#ffd2c8] hover:bg-[#d53d18]/20 transition",
                            busy && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Users */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-black italic text-white">User lookup</h2>
          <p className="mt-1 text-sm text-white/50">Search by email and manage tier/admin role independently.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/25"
            />
            <button
              type="button"
              disabled={busy || userEmail.trim().length < 3}
              onClick={() => {
                startTransition(async () => {
                  setUserLookupState("loading");
                  setUserResult(null);

                  try {
                    const res = await fetch(`/api/admin/users?email=${encodeURIComponent(userEmail.trim())}`, {
                      cache: "no-store",
                    });
                    const json = await res.json();
                    if (json?.ok) {
                      if (!json.user) {
                        setUserLookupState("notfound");
                        return;
                      }
                      setUserLookupState("idle");
                      setUserResult(json.user);
                      return;
                    }

                    setUserLookupState("error");
                  } catch {
                    setUserLookupState("error");
                  }
                });
              }}
              className={cn(
                "h-11 rounded-xl px-6",
                "bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "hover:brightness-105 transition",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              Search
            </button>
          </div>

          {userLookupState === "loading" ? (
            <div className="mt-4 text-sm text-white/50">Searching…</div>
          ) : null}
          {userLookupState === "notfound" ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              No user found for that email.
            </div>
          ) : null}
          {userLookupState === "error" ? (
            <div className="mt-4 rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 p-4 text-sm text-[#ffd2c8]">
              Failed to search user.
            </div>
          ) : null}

          {userResult ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-display text-lg font-black italic text-white">
                    {userResult.username ?? userResult.name ?? "User"}
                  </div>
                  <div className="mt-1 text-sm text-white/50">{userResult.email}</div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                    ID: {userResult.id}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      startTransition(async () => {
                        const nextRole = userResult.role === "ADMIN" ? "USER" : "ADMIN";
                        const prev = userResult;
                        setUserResult({ ...prev, role: nextRole });
                        const res = await fetch("/api/admin/users", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: prev.id, role: nextRole }),
                        });
                        if (!res.ok) setUserResult(prev);
                      });
                    }}
                    className={cn(
                      "h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
                      "border border-white/10 transition",
                      userResult.role === "ADMIN"
                        ? "bg-lime-300/10 text-lime-100 hover:bg-lime-300/15"
                        : "bg-white/5 text-white/60 hover:bg-white/10",
                      busy && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {userResult.role === "ADMIN" ? "Admin: ON" : "Admin: OFF"}
                  </button>

                  <select
                    value={userResult.accountTier}
                    disabled={busy}
                    onChange={(e) => {
                      const nextTier = e.target.value as typeof userResult.accountTier;
                      const prev = userResult;
                      setUserResult({ ...prev, accountTier: nextTier });
                      startTransition(async () => {
                        const res = await fetch("/api/admin/users", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: prev.id, accountTier: nextTier }),
                        });
                        if (!res.ok) setUserResult(prev);
                      });
                    }}
                    className={cn(
                      "h-10 rounded-xl border border-white/10 bg-white/5 px-3",
                      "text-xs font-black uppercase tracking-[0.22em] text-white/70",
                      "focus:outline-none",
                      busy && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <option value="FREE">FREE</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ELITE">ELITE</option>
                    <option value="FRIENDS_AND_FAMILY">FRIENDS &amp; FAMILY</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/40">
                Tier and admin role are independent (can be set separately).
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
