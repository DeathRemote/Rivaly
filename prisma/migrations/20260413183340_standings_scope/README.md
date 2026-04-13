Adds StandingsRow.scope (required by the Prisma schema) and backfills existing rows to `season:<competitionSeasonId>`.
Also adds the unique index used by upserts: (scope, teamId).
