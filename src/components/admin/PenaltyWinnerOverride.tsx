"use client";

import { useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type MatchLookup = {
  id: string;
  status: string;
  kickoffAt: string;
  knockoutRound: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  result: { homeScore: number; awayScore: number; advancesTeamId: string | null } | null;
  competitionSeason: { id: string; seasonLabel: string; competition: { name: string } };
  competitionPhase: { type: string; name: string } | null;
};

export function PenaltyWinnerOverride() {
  const [pending, startTransition] = useTransition();
  const [providerMatchId, setProviderMatchId] = useState("");
  const [match, setMatch] = useState<MatchLookup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canLookup = useMemo(() => providerMatchId.trim().length >= 4 && !pending, [providerMatchId, pending]);

  const canSet = useMemo(() => {
    if (!match) return false;
    if (!match.knockoutRound) return false;
    if (!match.result) return false;
    if (match.result.homeScore !== match.result.awayScore) return false;
    return !pending;
  }, [match, pending]);

  async function lookup() {
    setMessage(null);
    setMatch(null);

    const res = await fetch(
      `/api/admin/matches/lookup?providerMatchId=${encodeURIComponent(providerMatchId.trim())}`,
      { cache: "no-store" },
    );
    const json = (await res.json().catch(() => null)) as { ok?: boolean; match?: MatchLookup | null; error?: string } | null;

    if (!res.ok || !json?.ok) {
      setMessage(json?.error ? `Lookup failed: ${json.error}` : "Lookup failed");
      return;
    }

    if (!json.match) {
      setMessage("No match found for that provider event id.");
      return;
    }

    setMatch(json.match);
  }

  async function setAdvances(advancesTeamId: string) {
    if (!match) return;

    const res = await fetch(`/api/admin/matches/${encodeURIComponent(match.id)}/set-advances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advancesTeamId }),
    });

    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!res.ok || !json?.ok) {
      setMessage(json?.error ? `Update failed: ${json.error}` : "Update failed");
      return;
    }

    setMessage("Saved. Post-match processor will score once advances is set.");
    await lookup();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={providerMatchId}
          onChange={(e) => setProviderMatchId(e.target.value)}
          placeholder="TheSportsDB event id (e.g. 2084979)"
          className="h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/25"
        />
        <button
          type="button"
          disabled={!canLookup}
          onClick={() => {
            startTransition(async () => {
              await lookup();
            });
          }}
          className={cn(
            "h-11 rounded-xl px-4 text-xs font-black uppercase tracking-[0.22em]",
            "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition",
            (!canLookup || pending) && "opacity-60 cursor-not-allowed",
          )}
        >
          {pending ? "Loading…" : "Lookup"}
        </button>
      </div>

      {message ? <div className="mt-4 text-sm text-white/60">{message}</div> : null}

      {match ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
            {match.competitionSeason.competition.name} {match.competitionSeason.seasonLabel}
          </div>
          <div className="mt-2 text-white font-bold">
            {match.homeTeam.name} <span className="text-white/40">vs</span> {match.awayTeam.name}
          </div>
          <div className="mt-2 text-sm text-white/50">
            {new Date(match.kickoffAt).toLocaleString()} · {match.knockoutRound ? `Knockout ${match.knockoutRound}` : "Not knockout"}
          </div>

          <div className="mt-3 text-sm text-white/70">
            Result: {match.result ? `${match.result.homeScore}-${match.result.awayScore}` : "(none)"}
            {match.result?.advancesTeamId ? (
              <span className="text-white/50">
                {" "}
                · Advances set
              </span>
            ) : null}
          </div>

          {canSet ? (
            <div className="mt-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                Set who advanced
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await setAdvances(match.homeTeamId);
                    });
                  }}
                  className={cn(
                    "h-12 rounded-2xl border border-white/10 bg-black/30",
                    "text-[10px] font-black uppercase tracking-[0.22em] text-white/70 hover:bg-white/5",
                    pending && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {match.homeTeam.name}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await setAdvances(match.awayTeamId);
                    });
                  }}
                  className={cn(
                    "h-12 rounded-2xl border border-white/10 bg-black/30",
                    "text-[10px] font-black uppercase tracking-[0.22em] text-white/70 hover:bg-white/5",
                    pending && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {match.awayTeam.name}
                </button>
              </div>

              <div className="mt-3 text-[11px] text-white/35">
                After saving, the next post-match run will score predictions for this match.
              </div>
            </div>
          ) : (
            <div className="mt-4 text-[11px] text-white/35">
              This tool is only available for finished knockout matches that ended in a draw.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
