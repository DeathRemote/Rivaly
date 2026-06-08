import { z } from "zod";

const TheSportsDbEventSchema = z.object({
  idEvent: z.string().min(1),
  idLeague: z.string().optional().nullable(),
  strLeague: z.string().optional().nullable(),
  strSeason: z.string().optional().nullable(),

  // Tournament structure hints (not always present)
  intRound: z.coerce.number().optional().nullable(),
  strGroup: z.string().optional().nullable(),
  strEvent: z.string().optional().nullable(),

  idHomeTeam: z.string().optional().nullable(),
  idAwayTeam: z.string().optional().nullable(),
  strHomeTeam: z.string().optional().nullable(),
  strAwayTeam: z.string().optional().nullable(),

  intHomeScore: z.coerce.number().optional().nullable(),
  intAwayScore: z.coerce.number().optional().nullable(),

  dateEvent: z.string().optional().nullable(),
  strTime: z.string().optional().nullable(),
  strTimestamp: z.string().optional().nullable(),

  strStatus: z.string().optional().nullable(),

  // Soccer knockouts sometimes encode penalty winner here.
  strResult: z.string().optional().nullable(),
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

const TableRowSchema = z.object({
  intRank: z.coerce.number(),
  idTeam: z.string().min(1),
  strTeam: z.string().min(1),
  intPlayed: z.coerce.number(),
  intWin: z.coerce.number(),
  intDraw: z.coerce.number(),
  intLoss: z.coerce.number(),

  // Some leagues include these; keep optional for compatibility.
  intGoalsFor: z.coerce.number().optional().nullable(),
  intGoalsAgainst: z.coerce.number().optional().nullable(),

  intGoalDifference: z.coerce.number().optional().nullable(),
  intPoints: z.coerce.number(),
});

const LookupTableResponseSchema = z.object({
  table: z.array(TableRowSchema).nullable().optional(),
});

export type TheSportsDbTableRow = z.infer<typeof TableRowSchema>;

const SeasonsResponseSchema = z.object({
  seasons: z.array(SeasonSchema).nullable().optional(),
});

const LeagueSchema = z.object({
  idLeague: z.string().min(1),
  strLeague: z.string().min(1),
  strSport: z.string().optional().nullable(),
  strLeagueAlternate: z.string().optional().nullable(),
  strCountry: z.string().optional().nullable(),
});

const AllLeaguesResponseSchema = z.object({
  leagues: z.array(LeagueSchema).nullable().optional(),
});

const LookupLeagueResponseSchema = z.object({
  leagues: z.array(
    LeagueSchema.extend({
      strBadge: z.string().optional().nullable(),
    }),
  )
    .nullable()
    .optional(),
});

export type TheSportsDbEvent = z.infer<typeof TheSportsDbEventSchema>;
export type TheSportsDbLeague = z.infer<typeof LeagueSchema>;

export class TheSportsDbClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    // NOTE: env vars often pick up accidental whitespace; trim to avoid 404s from malformed URLs.
    // Prefer THE_SPORTS_DB_API_KEY when set; fall back to the free key (123) only when empty.
    const rawKey = (opts?.apiKey ?? process.env.THE_SPORTS_DB_API_KEY ?? "").trim();
    this.apiKey = rawKey.length > 0 ? rawKey : "123";

    this.baseUrl = (opts?.baseUrl ?? "https://www.thesportsdb.com/api/v1/json").trim();
  }

  async listAllLeagues() {
    // Returns all leagues across sports. We'll filter client-side (e.g. Soccer only).
    const url = `${this.baseUrl}/${this.apiKey}/all_leagues.php`;
    const json = await this.fetchJson(url);
    const parsed = AllLeaguesResponseSchema.parse(json);
    return parsed.leagues ?? [];
  }

  async lookupLeague(leagueId: string) {
    const url = `${this.baseUrl}/${this.apiKey}/lookupleague.php?id=${encodeURIComponent(leagueId)}`;
    const json = await this.fetchJson(url);
    const parsed = LookupLeagueResponseSchema.parse(json);
    return parsed.leagues?.[0] ?? null;
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

  async lookupLeagueTable(leagueId: string, seasonLabel: string) {
    const url = `${this.baseUrl}/${this.apiKey}/lookuptable.php?l=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(seasonLabel)}`;
    const json = await this.fetchJson(url);
    const parsed = LookupTableResponseSchema.parse(json);
    return parsed.table ?? [];
  }

  async lookupEvent(eventId: string) {
    const url = `${this.baseUrl}/${this.apiKey}/lookupevent.php?id=${encodeURIComponent(eventId)}`;
    const json = await this.fetchJson(url);
    const parsed = z.object({ events: z.array(TheSportsDbEventSchema).nullable().optional() }).parse(json);
    return parsed.events?.[0] ?? null;
  }

  private async fetchJson(url: string) {
    // Cloudflare rate limits aggressively on free/test keys.
    // We retry with a small exponential backoff on 429.
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (process.env.THESPORTSDB_DEBUG === "1") {
        // Don't log API key separately; the URL contains it in v1.
        console.log(`[TheSportsDB] GET ${url}`);
      }

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text().catch(() => "");

      if (!res.ok) {
        if (res.status === 429 && attempt < 5) {
          const retryAfterHeader = res.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const sleepMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(1000, retryAfterSeconds * 1000)
            : 800 * attempt * attempt;
          await new Promise((r) => setTimeout(r, sleepMs));
          continue;
        }

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

    throw new Error("TheSportsDB request failed after retries");
  }
}
