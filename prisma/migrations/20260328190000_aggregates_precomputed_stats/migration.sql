-- CreateTable
CREATE TABLE "GroupMemberAccuracyAggregate" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoredTotal" INTEGER NOT NULL DEFAULT 0,
    "correctTotal" INTEGER NOT NULL DEFAULT 0,
    "last7d" INTEGER NOT NULL DEFAULT 0,
    "prev7d" INTEGER NOT NULL DEFAULT 0,
    "accuracyPctCached" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMemberAccuracyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMomentumAggregate" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "totalScored" INTEGER NOT NULL DEFAULT 0,
    "correctScored" INTEGER NOT NULL DEFAULT 0,
    "memberCountSnapshot" INTEGER NOT NULL DEFAULT 0,
    "momentumPctCached" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMomentumAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPredictionStatsAggregate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifetimeTotal" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCorrect" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "avgPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recent30dTotal" INTEGER NOT NULL DEFAULT 0,
    "recent30dCorrect" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPredictionStatsAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupMemberAccuracyAggregate_groupId_userId_key" ON "GroupMemberAccuracyAggregate"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupMemberAccuracyAggregate_groupId_idx" ON "GroupMemberAccuracyAggregate"("groupId");

-- CreateIndex
CREATE INDEX "GroupMemberAccuracyAggregate_userId_idx" ON "GroupMemberAccuracyAggregate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMomentumAggregate_groupId_key" ON "GroupMomentumAggregate"("groupId");

-- CreateIndex
CREATE INDEX "GroupMomentumAggregate_updatedAt_idx" ON "GroupMomentumAggregate"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPredictionStatsAggregate_userId_key" ON "UserPredictionStatsAggregate"("userId");

-- CreateIndex
CREATE INDEX "UserPredictionStatsAggregate_updatedAt_idx" ON "UserPredictionStatsAggregate"("updatedAt");

-- AddForeignKey
ALTER TABLE "GroupMemberAccuracyAggregate" ADD CONSTRAINT "GroupMemberAccuracyAggregate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberAccuracyAggregate" ADD CONSTRAINT "GroupMemberAccuracyAggregate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMomentumAggregate" ADD CONSTRAINT "GroupMomentumAggregate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPredictionStatsAggregate" ADD CONSTRAINT "UserPredictionStatsAggregate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
