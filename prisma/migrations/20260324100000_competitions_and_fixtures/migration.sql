-- Add canonical competition/season/fixture tables + link groups to a season.

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE "Provider" AS ENUM ('THESPORTSDB');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED','LIVE','FINISHED','POSTPONED','CANCELED','UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Competition catalog
CREATE TABLE IF NOT EXISTS "Competition" (
  "id" TEXT NOT NULL,
  "sport" "Sport" NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "provider" "Provider",
  "providerLeagueId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Competition_provider_providerLeagueId_key"
  ON "Competition"("provider", "providerLeagueId");

CREATE INDEX IF NOT EXISTS "Competition_sport_published_idx"
  ON "Competition"("sport", "published");

CREATE TABLE IF NOT EXISTS "CompetitionSeason" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "seasonLabel" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "provider" "Provider",
  "providerSeasonId" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitionSeason_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompetitionSeason"
  ADD CONSTRAINT "CompetitionSeason_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionSeason_competitionId_seasonLabel_key"
  ON "CompetitionSeason"("competitionId", "seasonLabel");

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionSeason_provider_providerSeasonId_key"
  ON "CompetitionSeason"("provider", "providerSeasonId");

CREATE INDEX IF NOT EXISTS "CompetitionSeason_published_idx"
  ON "CompetitionSeason"("published");

CREATE TABLE IF NOT EXISTS "CompetitionPhase" (
  "id" TEXT NOT NULL,
  "competitionSeasonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitionPhase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompetitionPhase"
  ADD CONSTRAINT "CompetitionPhase_competitionSeasonId_fkey"
  FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionPhase_competitionSeasonId_name_key"
  ON "CompetitionPhase"("competitionSeasonId", "name");

-- 3) Teams & matches
CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "provider" "Provider",
  "providerTeamId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Team_provider_providerTeamId_key"
  ON "Team"("provider", "providerTeamId");

CREATE TABLE IF NOT EXISTS "Match" (
  "id" TEXT NOT NULL,
  "competitionSeasonId" TEXT NOT NULL,
  "competitionPhaseId" TEXT,
  "homeTeamId" TEXT NOT NULL,
  "awayTeamId" TEXT NOT NULL,
  "kickoffAt" TIMESTAMP(3) NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "provider" "Provider",
  "providerMatchId" TEXT,
  "visibleAt" TIMESTAMP(3),
  "lockAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_competitionSeasonId_fkey"
  FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_competitionPhaseId_fkey"
  FOREIGN KEY ("competitionPhaseId") REFERENCES "CompetitionPhase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_homeTeamId_fkey"
  FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_awayTeamId_fkey"
  FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Match_provider_providerMatchId_key"
  ON "Match"("provider", "providerMatchId");

CREATE INDEX IF NOT EXISTS "Match_competitionSeasonId_kickoffAt_idx"
  ON "Match"("competitionSeasonId", "kickoffAt");

-- 4) Link groups to CompetitionSeason
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "competitionSeasonId" TEXT;

ALTER TABLE "Group"
  ADD CONSTRAINT "Group_competitionSeasonId_fkey"
  FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Group_competitionSeasonId_idx"
  ON "Group"("competitionSeasonId");
