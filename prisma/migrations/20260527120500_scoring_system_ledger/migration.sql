-- Add scoring system to Group
CREATE TYPE "ScoringSystem" AS ENUM ('CLASSIC');

ALTER TABLE "Group" ADD COLUMN "scoringSystem" "ScoringSystem" NOT NULL DEFAULT 'CLASSIC';

-- Season points ledger
CREATE TYPE "SeasonPointsEventType" AS ENUM ('PREDICTION_SCORED');

CREATE TABLE "SeasonPointsEvent" (
  "id" TEXT NOT NULL,
  "competitionSeasonId" TEXT NOT NULL,
  "scoringSystem" "ScoringSystem" NOT NULL DEFAULT 'CLASSIC',
  "userId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "type" "SeasonPointsEventType" NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "SeasonPointsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonPointsEvent_competitionSeasonId_scoringSystem_userId_matchId_type_key"
  ON "SeasonPointsEvent"("competitionSeasonId", "scoringSystem", "userId", "matchId", "type");

CREATE INDEX "SeasonPointsEvent_competitionSeasonId_idx" ON "SeasonPointsEvent"("competitionSeasonId");
CREATE INDEX "SeasonPointsEvent_userId_idx" ON "SeasonPointsEvent"("userId");
CREATE INDEX "SeasonPointsEvent_matchId_idx" ON "SeasonPointsEvent"("matchId");

ALTER TABLE "SeasonPointsEvent"
  ADD CONSTRAINT "SeasonPointsEvent_competitionSeasonId_fkey" FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPointsEvent"
  ADD CONSTRAINT "SeasonPointsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPointsEvent"
  ADD CONSTRAINT "SeasonPointsEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Season user points aggregate (fast leaderboard reads)
CREATE TABLE "SeasonUserPoints" (
  "id" TEXT NOT NULL,
  "competitionSeasonId" TEXT NOT NULL,
  "scoringSystem" "ScoringSystem" NOT NULL DEFAULT 'CLASSIC',
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "SeasonUserPoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonUserPoints_competitionSeasonId_scoringSystem_userId_key"
  ON "SeasonUserPoints"("competitionSeasonId", "scoringSystem", "userId");

CREATE INDEX "SeasonUserPoints_competitionSeasonId_idx" ON "SeasonUserPoints"("competitionSeasonId");
CREATE INDEX "SeasonUserPoints_userId_idx" ON "SeasonUserPoints"("userId");

ALTER TABLE "SeasonUserPoints"
  ADD CONSTRAINT "SeasonUserPoints_competitionSeasonId_fkey" FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonUserPoints"
  ADD CONSTRAINT "SeasonUserPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill SeasonUserPoints from existing group member points.
-- NOTE: this assumes existing scoring is effectively classic.
INSERT INTO "SeasonUserPoints" ("id", "competitionSeasonId", "scoringSystem", "userId", "points", "updatedAt")
SELECT
  gen_random_uuid()::text,
  g."competitionSeasonId",
  'CLASSIC'::"ScoringSystem",
  gm."userId",
  MAX(gm."points")::int AS points,
  NOW()
FROM "GroupMember" gm
JOIN "Group" g ON g."id" = gm."groupId"
WHERE g."competitionSeasonId" IS NOT NULL
GROUP BY g."competitionSeasonId", gm."userId"
ON CONFLICT ("competitionSeasonId", "scoringSystem", "userId") DO NOTHING;
