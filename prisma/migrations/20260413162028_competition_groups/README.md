Adds CompetitionGroup support:
- CompetitionPhase.type enum + column
- CompetitionGroup table
- Match.competitionGroupId + FK/index
- StandingsRow.competitionGroupId + FK/index

This migration is written with IF NOT EXISTS guards to be safer on already-partially-migrated DBs.
