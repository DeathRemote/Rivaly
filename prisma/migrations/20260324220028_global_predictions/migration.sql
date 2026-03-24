-- Global predictions per user + match (not per group)

-- 1) Create Prediction table
CREATE TABLE IF NOT EXISTS "Prediction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "awayScore" INTEGER NOT NULL,
  "source" "PredictionSource" NOT NULL DEFAULT 'SCORE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- 2) Add FKs
DO $$ BEGIN
  ALTER TABLE "Prediction"
    ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Prediction"
    ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId")
    REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Uniqueness + indexes (must exist before using ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS "Prediction_userId_matchId_key" ON "Prediction"("userId", "matchId");
CREATE INDEX IF NOT EXISTS "Prediction_userId_idx" ON "Prediction"("userId");
CREATE INDEX IF NOT EXISTS "Prediction_matchId_idx" ON "Prediction"("matchId");

-- 4) Backfill from old group-scoped predictions (keep the latest per user+match)
INSERT INTO "Prediction" ("id", "userId", "matchId", "homeScore", "awayScore", "source", "createdAt", "updatedAt")
SELECT
  gp."id" AS "id",
  gp."userId",
  gp."matchKey" AS "matchId",
  gp."homeScore",
  gp."awayScore",
  gp."source",
  gp."createdAt",
  gp."updatedAt"
FROM (
  SELECT DISTINCT ON ("userId", "matchKey") *
  FROM "GroupPrediction"
  ORDER BY "userId", "matchKey", "updatedAt" DESC
) gp
ON CONFLICT ("userId", "matchId") DO NOTHING;

-- 5) Drop old table
DROP TABLE IF EXISTS "GroupPrediction";
