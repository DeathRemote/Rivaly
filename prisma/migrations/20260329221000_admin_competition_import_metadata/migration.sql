-- Add admin management metadata for competition seasons

ALTER TABLE "CompetitionSeason"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "fixturesSyncedAt" TIMESTAMP(3),
  ADD COLUMN "fixturesSyncError" TEXT;

CREATE INDEX "CompetitionSeason_archivedAt_idx" ON "CompetitionSeason"("archivedAt");
