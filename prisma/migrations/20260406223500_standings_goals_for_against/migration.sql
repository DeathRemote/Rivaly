-- Add goalsFor/goalsAgainst to support deterministic table sorting

ALTER TABLE "StandingsRow"
  ADD COLUMN IF NOT EXISTS "goalsFor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "goalsAgainst" INTEGER NOT NULL DEFAULT 0;
