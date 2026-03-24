-- Add stored league standings per competition season.

ALTER TABLE "CompetitionSeason" ADD COLUMN IF NOT EXISTS "standingsUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StandingsRow" (
  "id" TEXT NOT NULL,
  "competitionSeasonId" TEXT NOT NULL,
  "competitionPhaseId" TEXT,
  "teamId" TEXT NOT NULL,

  "position" INTEGER NOT NULL,
  "played" INTEGER NOT NULL,
  "wins" INTEGER NOT NULL,
  "draws" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  "goalDifference" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,

  "provider" "Provider",
  "providerTeamId" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StandingsRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StandingsRow"
  ADD CONSTRAINT "StandingsRow_competitionSeasonId_fkey"
  FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StandingsRow"
  ADD CONSTRAINT "StandingsRow_competitionPhaseId_fkey"
  FOREIGN KEY ("competitionPhaseId") REFERENCES "CompetitionPhase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StandingsRow"
  ADD CONSTRAINT "StandingsRow_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "StandingsRow_competitionSeasonId_teamId_key"
  ON "StandingsRow"("competitionSeasonId", "teamId");

CREATE UNIQUE INDEX IF NOT EXISTS "StandingsRow_provider_providerTeamId_key"
  ON "StandingsRow"("provider", "providerTeamId");

CREATE INDEX IF NOT EXISTS "StandingsRow_competitionSeasonId_position_idx"
  ON "StandingsRow"("competitionSeasonId", "position");
