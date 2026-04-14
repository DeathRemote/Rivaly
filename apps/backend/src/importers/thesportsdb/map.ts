import { MatchStatus, Provider } from "@prisma/client";
import type { TheSportsDbEvent } from "../../providers/thesportsdb/client.js";

export function mapTheSportsDbStatus(strStatus?: string | null): MatchStatus {
  const s = (strStatus ?? "").toLowerCase();

  if (s.includes("not started") || s.includes("scheduled")) return MatchStatus.SCHEDULED;
  if (s.includes("in progress") || s.includes("live")) return MatchStatus.LIVE;
  if (s.includes("finished") || s.includes("ft")) return MatchStatus.FINISHED;
  if (s.includes("postpon")) return MatchStatus.POSTPONED;
  if (s.includes("cancel")) return MatchStatus.CANCELED;

  return MatchStatus.UNKNOWN;
}
