import { MatchStatus, Provider } from "@prisma/client";
import type { TheSportsDbEvent } from "@/lib/providers/thesportsdb/client";

export function mapTheSportsDbStatus(strStatus?: string | null): MatchStatus {
  const s = (strStatus ?? "").toLowerCase();

  if (s.includes("not started") || s.includes("scheduled")) return MatchStatus.SCHEDULED;
  if (s.includes("in progress") || s.includes("live")) return MatchStatus.LIVE;
  // TheSportsDB uses a few soccer-specific finish codes:
  // - FT  = Full Time
  // - AET = After Extra Time
  // - PEN / PSO-like strings sometimes appear depending on source
  if (s.includes("finished") || s === "ft" || s.includes("ft") || s === "aet" || s.includes("aet") || s.includes("pen")) {
    return MatchStatus.FINISHED;
  }
  if (s.includes("postpon")) return MatchStatus.POSTPONED;
  if (s.includes("cancel")) return MatchStatus.CANCELED;

  return MatchStatus.UNKNOWN;
}

export function mapTheSportsDbKickoffAt(e: TheSportsDbEvent): Date {
  if (e.strTimestamp) {
    const d = new Date(e.strTimestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }

  if (e.dateEvent) {
    const time = e.strTime && e.strTime.length >= 5 ? e.strTime : "00:00:00";
    const iso = `${e.dateEvent}T${time}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  throw new Error(`Cannot parse kickoffAt for event idEvent=${e.idEvent}`);
}

function inferKnockoutRound(opts: {
  providerRound?: number | null;
  eventName?: string | null;
  providerGroupKey?: string | null;
}) {
  const r = opts.providerRound ?? null;
  const name = (opts.eventName ?? "").toLowerCase();
  const groupKey = (opts.providerGroupKey ?? "").trim();

  // Safety: group-stage fixtures can have numeric rounds too (e.g. matchday/round 2).
  // For World Cup-style group matches, TheSportsDB populates `strGroup`.
  // So if a providerGroupKey exists, do NOT infer knockout from numeric rounds.
  if (groupKey) return null;

  // TheSportsDB docs mention special round numbers (not exhaustive):
  // 125=Quarter-Final, 150=Semi-Final, 200=Final, 400=Qualifier, 500=Pre-Season.
  if (r === 125) return "QF" as const;
  if (r === 150) return "SF" as const;
  if (r === 200) return "FINAL" as const;
  if (r === 170) return "SF" as const; // playoff semi-final
  if (r === 180) return "FINAL" as const; // playoff final
  if (r === 160) return "PLAYOFF" as const;
  if (r === 400) return "QUALIFIER" as const;

  // Numeric bracket rounds used by some competitions/providers.
  // Only apply when groupKey is missing (see guard above).
  if (r === 64) return "R64" as const;
  if (r === 32) return "R32" as const;
  if (r === 16) return "R16" as const;
  if (r === 8) return "QF" as const;
  if (r === 4) return "SF" as const;
  if (r === 2) return "FINAL" as const;

  // Name-based inference fallback.
  if (name.includes("third place") || name.includes("3rd place") || name.includes("third-place")) return "THIRD_PLACE" as const;
  if (name.includes("quarter")) return "QF" as const;
  if (name.includes("semi")) return "SF" as const;
  if (name.includes("final") && !name.includes("semi") && !name.includes("quarter")) return "FINAL" as const;
  if (name.includes("round of 16") || name.includes("last 16")) return "R16" as const;
  if (name.includes("round of 32") || name.includes("last 32")) return "R32" as const;
  if (name.includes("round of 64") || name.includes("last 64")) return "R64" as const;

  return null;
}

export function mapTheSportsDbEventToDomain(e: TheSportsDbEvent) {
  if (!e.idEvent) throw new Error("Missing idEvent");

  const homeName = e.strHomeTeam ?? undefined;
  const awayName = e.strAwayTeam ?? undefined;
  if (!homeName || !awayName) {
    throw new Error(`Missing team names for event idEvent=${e.idEvent}`);
  }

  if (!e.idHomeTeam) throw new Error(`Missing idHomeTeam for event idEvent=${e.idEvent}`);
  if (!e.idAwayTeam) throw new Error(`Missing idAwayTeam for event idEvent=${e.idEvent}`);

  const knockoutRound = inferKnockoutRound({
    providerRound: e.intRound,
    eventName: e.strEvent,
    providerGroupKey: e.strGroup,
  });

  return {
    provider: Provider.THESPORTSDB,
    providerMatchId: e.idEvent,
    kickoffAt: mapTheSportsDbKickoffAt(e),
    status: mapTheSportsDbStatus(e.strStatus),

    providerRound: e.intRound ?? null,
    providerGroupKey: e.strGroup ?? null,
    knockoutRound,

    homeTeam: {
      provider: Provider.THESPORTSDB,
      providerTeamId: e.idHomeTeam,
      name: homeName,
    },
    awayTeam: {
      provider: Provider.THESPORTSDB,
      providerTeamId: e.idAwayTeam,
      name: awayName,
    },
  };
}
