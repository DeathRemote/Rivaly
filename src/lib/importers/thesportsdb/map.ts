import { MatchStatus, Provider } from "@prisma/client";
import type { TheSportsDbEvent } from "@/lib/providers/thesportsdb/client";

export function mapTheSportsDbStatus(strStatus?: string | null): MatchStatus {
  const s = (strStatus ?? "").toLowerCase();

  if (s.includes("not started") || s.includes("scheduled")) return MatchStatus.SCHEDULED;
  if (s.includes("in progress") || s.includes("live")) return MatchStatus.LIVE;
  if (s.includes("finished") || s.includes("ft")) return MatchStatus.FINISHED;
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

export function mapTheSportsDbEventToDomain(e: TheSportsDbEvent) {
  if (!e.idEvent) throw new Error("Missing idEvent");

  const homeName = e.strHomeTeam ?? undefined;
  const awayName = e.strAwayTeam ?? undefined;
  if (!homeName || !awayName) {
    throw new Error(`Missing team names for event idEvent=${e.idEvent}`);
  }

  if (!e.idHomeTeam) throw new Error(`Missing idHomeTeam for event idEvent=${e.idEvent}`);
  if (!e.idAwayTeam) throw new Error(`Missing idAwayTeam for event idEvent=${e.idEvent}`);

  return {
    provider: Provider.THESPORTSDB,
    providerMatchId: e.idEvent,
    kickoffAt: mapTheSportsDbKickoffAt(e),
    status: mapTheSportsDbStatus(e.strStatus),

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
