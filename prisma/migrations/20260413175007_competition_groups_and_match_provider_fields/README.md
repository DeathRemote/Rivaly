Fixes DB drift vs prisma/schema.prisma by adding:
- CompetitionPhase.type (CompetitionPhaseType)
- CompetitionGroup table
- Match.providerRound / providerGroupKey / competitionGroupId / knockoutRound
- StandingsRow.competitionGroupId

This prevents runtime Prisma errors (P2022) when the importer/sync writes these fields.
