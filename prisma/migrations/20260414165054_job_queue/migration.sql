-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SCORE_MATCH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lockedAt" TIMESTAMPTZ,
    "lockedBy" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_lockedAt_idx" ON "Job"("lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_type_dedupeKey_key" ON "Job"("type", "dedupeKey");
