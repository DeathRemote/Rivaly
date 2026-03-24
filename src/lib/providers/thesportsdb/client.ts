import { z } from "zod";

const TheSportsDbEventSchema = z.object({
  idEvent: z.string().min(1),
  idLeague: z.string().optional().nullable(),
  strLeague: z.string().optional().nullable(),
  strSeason: z.string().optional().nullable(),

  idHomeTeam: z.string().optional().nullable(),
  idAwayTeam: z.string().optional().nullable(),
  strHomeTeam: z.string().optional().nullable(),
  strAwayTeam: z.string().optional().nullable(),

  dateEvent: z.string().optional().nullable(),
  strTime: z.string().optional().nullable(),
  strTimestamp: z.string().optional().nullable(),

  strStatus: z.string().optional().nullable(),
});

const EventsSeasonResponseSchema = z.object({
  events: z.array(TheSportsDbEventSchema).nullable().optional(),
});

const EventsRoundResponseSchema = z.object({
  events: z.array(TheSportsDbEventSchema).nullable().optional(),
});

const SeasonSchema = z.object({
  strSeason: z.string().min(1),
  idSeason: z.string().optional().nullable(),
});

const SeasonsResponseSchema = z.object({
  seasons: z.array(SeasonSchema).nullable().optional(),
});

export type TheSportsDbEvent = z.infer<typeof TheSportsDbEventSchema>;

export class TheSportsDbClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.THE_SPORTS_DB_API_KEY ?? "3";
    this.baseUrl = opts?.baseUrl ?? "https://www.thesportsdb.com/api/v1/json";
  }

  async listSeasonsForLeague(leagueId: string) {
    const url = `${this.baseUrl}/${this.apiKey}/search_all_seasons.php?id=${encodeURIComponent(leagueId)}`;
    const json = await this.fetchJson(url);
    const parsed = SeasonsResponseSchema.parse(json);
    return parsed.seasons ?? [];
  }

  async listEventsForLeagueSeason(leagueId: string, seasonLabel: string) {
    const url = `${this.baseUrl}/${this.apiKey}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(seasonLabel)}`;
    const json = await this.fetchJson(url);
    const parsed = EventsSeasonResponseSchema.parse(json);
    return parsed.events ?? [];
  }

  async listEventsForLeagueSeasonRound(leagueId: string, seasonLabel: string, round: number) {
    const url = `${this.baseUrl}/${this.apiKey}/eventsround.php?id=${encodeURIComponent(leagueId)}&r=${encodeURIComponent(String(round))}&s=${encodeURIComponent(seasonLabel)}`;
    const json = await this.fetchJson(url);
    const parsed = EventsRoundResponseSchema.parse(json);
    return parsed.events ?? [];
  }

  private async fetchJson(url: string) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `TheSportsDB request failed: ${res.status} ${res.statusText} :: ${text.slice(0, 300)}`,
      );
    }

    // Sometimes free/test keys get an HTML page; fail fast with a clear error.
    if (!contentType.includes("application/json") || text.trim().startsWith("<")) {
      throw new Error(
        `TheSportsDB returned non-JSON (content-type=${contentType || "<none>"}). ` +
          `Likely rate-limited or blocked. Response starts: ${text.slice(0, 80)}`,
      );
    }

    return JSON.parse(text);
  }
}
