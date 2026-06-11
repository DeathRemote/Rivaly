-- Drop legacy unique index that prevents multiple standings rows per team within a season.
-- We now key StandingsRow by (scope, teamId) to support league table + group tables.

DROP INDEX IF EXISTS "StandingsRow_competitionSeasonId_teamId_key";
