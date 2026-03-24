-- Post-match processing primitives: MatchResult, PointsEvent, processed markers.

-- Match: add finalizedAt/processedAt
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

-- Index to help polling queries
CREATE INDEX IF NOT EXISTS "Match_status_kickoffAt_idx" ON "Match"("status", "kickoffAt");

-- MatchResult
CREATE TABLE IF NOT EXISTS "MatchResult" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "awayScore" INTEGER NOT NULL,
  "provider" "Provider",
  "providerEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchResult_matchId_key" ON "MatchResult"("matchId");

ALTER TABLE "MatchResult"
  ADD CONSTRAINT "MatchResult_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Points ledger
DO $$ BEGIN
  CREATE TYPE "PointsEventType" AS ENUM ('PREDICTION_SCORED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PointsEvent" (
  "id" TEXT NOT NULL,
  "type" "PointsEventType" NOT NULL DEFAULT 'PREDICTION_SCORED',
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PointsEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PointsEvent"
  ADD CONSTRAINT "PointsEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsEvent"
  ADD CONSTRAINT "PointsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsEvent"
  ADD CONSTRAINT "PointsEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PointsEvent_groupId_userId_matchId_type_key"
  ON "PointsEvent"("groupId", "userId", "matchId", "type");

CREATE INDEX IF NOT EXISTS "PointsEvent_groupId_createdAt_idx" ON "PointsEvent"("groupId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsEvent_userId_createdAt_idx" ON "PointsEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsEvent_matchId_idx" ON "PointsEvent"("matchId");
