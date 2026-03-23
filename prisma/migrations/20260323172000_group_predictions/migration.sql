-- Add group-scoped predictions (GroupPrediction)

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PredictionSource') THEN
    CREATE TYPE "PredictionSource" AS ENUM ('QUICK_PICK', 'SCORE');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GroupPrediction" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matchKey" TEXT NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "awayScore" INTEGER NOT NULL,
  "source" "PredictionSource" NOT NULL DEFAULT 'SCORE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GroupPrediction_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPrediction_groupId_userId_matchKey_key"
  ON "GroupPrediction"("groupId", "userId", "matchKey");

CREATE INDEX IF NOT EXISTS "GroupPrediction_groupId_idx" ON "GroupPrediction"("groupId");
CREATE INDEX IF NOT EXISTS "GroupPrediction_userId_idx" ON "GroupPrediction"("userId");
CREATE INDEX IF NOT EXISTS "GroupPrediction_matchKey_idx" ON "GroupPrediction"("matchKey");

-- Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GroupPrediction_groupId_fkey'
  ) THEN
    ALTER TABLE "GroupPrediction"
      ADD CONSTRAINT "GroupPrediction_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GroupPrediction_userId_fkey'
  ) THEN
    ALTER TABLE "GroupPrediction"
      ADD CONSTRAINT "GroupPrediction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
