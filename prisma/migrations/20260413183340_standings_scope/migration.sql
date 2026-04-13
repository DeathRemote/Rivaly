-- Add StandingsRow.scope (required by current Prisma schema) and supporting indexes.
-- Backfill existing rows to scope = 'season:<competitionSeasonId>' for league tables.

ALTER TABLE "StandingsRow" ADD COLUMN IF NOT EXISTS "scope" TEXT;

-- Backfill scope for existing rows (league snapshot default)
UPDATE "StandingsRow"
SET "scope" = CONCAT('season:', "competitionSeasonId")
WHERE "scope" IS NULL;

-- Enforce NOT NULL to match Prisma schema.
ALTER TABLE "StandingsRow" ALTER COLUMN "scope" SET NOT NULL;

-- Unique constraint used by upserts: @@unique([scope, teamId])
CREATE UNIQUE INDEX IF NOT EXISTS "StandingsRow_scope_teamId_key"
  ON "StandingsRow"("scope", "teamId");

CREATE INDEX IF NOT EXISTS "StandingsRow_scope_idx"
  ON "StandingsRow"("scope");
