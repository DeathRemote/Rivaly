-- Knockout predictions: support "who advances" on penalties.
--
-- Adds optional advancesTeamId to:
-- - Prediction (user pick when they predict a draw in knockout)
-- - MatchResult (actual advancing team when match decided on penalties)
--
-- Safe to run on existing data; columns are nullable.

ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "advancesTeamId" TEXT;
CREATE INDEX IF NOT EXISTS "Prediction_advancesTeamId_idx" ON "Prediction"("advancesTeamId");
ALTER TABLE "Prediction"
  ADD CONSTRAINT IF NOT EXISTS "Prediction_advancesTeamId_fkey"
  FOREIGN KEY ("advancesTeamId") REFERENCES "Team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchResult" ADD COLUMN IF NOT EXISTS "advancesTeamId" TEXT;
CREATE INDEX IF NOT EXISTS "MatchResult_advancesTeamId_idx" ON "MatchResult"("advancesTeamId");
ALTER TABLE "MatchResult"
  ADD CONSTRAINT IF NOT EXISTS "MatchResult_advancesTeamId_fkey"
  FOREIGN KEY ("advancesTeamId") REFERENCES "Team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
