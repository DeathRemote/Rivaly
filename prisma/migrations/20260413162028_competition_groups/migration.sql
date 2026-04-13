-- Add CompetitionGroup + competitionGroupId links.

-- 1) CompetitionPhaseType enum + CompetitionPhase.type column
DO $$ BEGIN
  CREATE TYPE "CompetitionPhaseType" AS ENUM ('LEAGUE','GROUP_STAGE','KNOCKOUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "CompetitionPhase" ADD COLUMN IF NOT EXISTS "type" "CompetitionPhaseType" NOT NULL DEFAULT 'LEAGUE';

CREATE INDEX IF NOT EXISTS "CompetitionPhase_competitionSeasonId_type_idx"
  ON "CompetitionPhase"("competitionSeasonId", "type");

-- 2) CompetitionGroup table
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

ALTER TABLE "CompetitionGroup"
  ADD CONSTRAINT "CompetitionGroup_competitionPhaseId_fkey"
  FOREIGN KEY ("competitionPhaseId") REFERENCES "CompetitionPhase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionGroup_competitionPhaseId_key_key"
  ON "CompetitionGroup"("competitionPhaseId", "key");

CREATE INDEX IF NOT EXISTS "CompetitionGroup_competitionPhaseId_order_idx"
  ON "CompetitionGroup"("competitionPhaseId", "order");

-- 3) Link Match + StandingsRow to CompetitionGroup
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "competitionGroupId" TEXT;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_competitionGroupId_fkey"
  FOREIGN KEY ("competitionGroupId") REFERENCES "CompetitionGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Match_competitionGroupId_kickoffAt_idx"
  ON "Match"("competitionGroupId", "kickoffAt");

ALTER TABLE "StandingsRow" ADD COLUMN IF NOT EXISTS "competitionGroupId" TEXT;

ALTER TABLE "StandingsRow"
  ADD CONSTRAINT "StandingsRow_competitionGroupId_fkey"
  FOREIGN KEY ("competitionGroupId") REFERENCES "CompetitionGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "StandingsRow_competitionGroupId_position_idx"
  ON "StandingsRow"("competitionGroupId", "position");
