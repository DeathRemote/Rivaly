-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "isJoinable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OfficialPublicGroup" (
    "id" TEXT NOT NULL,
    "competitionSeasonId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "OfficialPublicGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialPublicGroup_competitionSeasonId_key" ON "OfficialPublicGroup"("competitionSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialPublicGroup_groupId_key" ON "OfficialPublicGroup"("groupId");

-- AddForeignKey
ALTER TABLE "OfficialPublicGroup" ADD CONSTRAINT "OfficialPublicGroup_competitionSeasonId_fkey" FOREIGN KEY ("competitionSeasonId") REFERENCES "CompetitionSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialPublicGroup" ADD CONSTRAINT "OfficialPublicGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
