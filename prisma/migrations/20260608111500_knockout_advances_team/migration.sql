-- Knockout predictions: support "who advances" on penalties.
--
-- Adds optional advancesTeamId to:
-- - Prediction (user pick when they predict a draw in knockout)
-- - MatchResult (actual advancing team when match decided on penalties)
--
-- Safe to run on existing data; columns are nullable.

ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "advancesTeamId" TEXT;
CREATE INDEX IF NOT EXISTS "Prediction_advancesTeamId_idx" ON "Prediction"("advancesTeamId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Prediction_advancesTeamId_fkey'
  ) THEN
    ALTER TABLE "Prediction"
      ADD CONSTRAINT "Prediction_advancesTeamId_fkey"
      FOREIGN KEY ("advancesTeamId") REFERENCES "Team"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "MatchResult" ADD COLUMN IF NOT EXISTS "advancesTeamId" TEXT;
CREATE INDEX IF NOT EXISTS "MatchResult_advancesTeamId_idx" ON "MatchResult"("advancesTeamId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MatchResult_advancesTeamId_fkey'
  ) THEN
    ALTER TABLE "MatchResult"
      ADD CONSTRAINT "MatchResult_advancesTeamId_fkey"
      FOREIGN KEY ("advancesTeamId") REFERENCES "Team"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
