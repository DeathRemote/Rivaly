-- Bring the physical DB schema in sync with prisma/schema.prisma for competitions + fixtures.
-- This fixes runtime errors like:
-- - Match.providerRound does not exist
-- - Match.competitionGroupId does not exist
--
-- Written defensively with IF NOT EXISTS guards to tolerate partial application.

-- 1) CompetitionPhaseType enum + CompetitionPhase.type
DO $$ BEGIN
  CREATE TYPE "CompetitionPhaseType" AS ENUM ('LEAGUE','GROUP_STAGE','KNOCKOUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "CompetitionPhase" ADD COLUMN IF NOT EXISTS "type" "CompetitionPhaseType" NOT NULL DEFAULT 'LEAGUE';

CREATE INDEX IF NOT EXISTS "CompetitionPhase_competitionSeasonId_type_idx"
  ON "CompetitionPhase"("competitionSeasonId", "type");

-- 2) KnockoutRound enum (used by Match.knockoutRound)
DO $$ BEGIN
  CREATE TYPE "KnockoutRound" AS ENUM ('R128','R64','R32','R16','QF','SF','FINAL','THIRD_PLACE','PLAYOFF','QUALIFIER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3) CompetitionGroup table
CREATE TABLE IF NOT EXISTS "CompetitionGroup" (
  "id" TEXT NOT NULL,
  "competitionPhaseId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitionGroup_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CompetitionGroup"
    ADD CONSTRAINT "CompetitionGroup_competitionPhaseId_fkey"
    FOREIGN KEY ("competitionPhaseId") REFERENCES "CompetitionPhase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionGroup_competitionPhaseId_key_key"
  ON "CompetitionGroup"("competitionPhaseId", "key");

CREATE INDEX IF NOT EXISTS "CompetitionGroup_competitionPhaseId_order_idx"
  ON "CompetitionGroup"("competitionPhaseId", "order");

-- 4) Match columns used by importer / API
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "competitionGroupId" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "providerRound" INTEGER;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "providerGroupKey" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "knockoutRound" "KnockoutRound";

DO $$ BEGIN
  ALTER TABLE "Match"
    ADD CONSTRAINT "Match_competitionGroupId_fkey"
    FOREIGN KEY ("competitionGroupId") REFERENCES "CompetitionGroup"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Match_competitionGroupId_kickoffAt_idx"
  ON "Match"("competitionGroupId", "kickoffAt");

CREATE INDEX IF NOT EXISTS "Match_competitionPhaseId_kickoffAt_idx"
  ON "Match"("competitionPhaseId", "kickoffAt");

-- 5) StandingsRow.competitionGroupId
ALTER TABLE "StandingsRow" ADD COLUMN IF NOT EXISTS "competitionGroupId" TEXT;

DO $$ BEGIN
  ALTER TABLE "StandingsRow"
    ADD CONSTRAINT "StandingsRow_competitionGroupId_fkey"
    FOREIGN KEY ("competitionGroupId") REFERENCES "CompetitionGroup"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "StandingsRow_competitionGroupId_position_idx"
  ON "StandingsRow"("competitionGroupId", "position");
