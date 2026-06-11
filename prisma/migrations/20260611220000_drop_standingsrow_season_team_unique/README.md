Drops the legacy unique index `StandingsRow_competitionSeasonId_teamId_key`.

That index prevented storing multiple standings rows for the same team within a single season (e.g. overall league table scope + per-group scope). The current schema uses `@@unique([scope, teamId])` instead.
