-- Add Groups + GroupMember models

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupVisibility') THEN
    CREATE TYPE "GroupVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupMemberRole') THEN
    CREATE TYPE "GroupMemberRole" AS ENUM ('MEMBER', 'ADMIN');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Group" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "visibility" "GroupVisibility" NOT NULL DEFAULT 'PRIVATE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GroupMember" (
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "points" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId", "userId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Group_visibility_idx" ON "Group"("visibility");
CREATE INDEX IF NOT EXISTS "Group_createdById_idx" ON "Group"("createdById");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Group_createdById_fkey'
  ) THEN
    ALTER TABLE "Group"
      ADD CONSTRAINT "Group_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GroupMember_groupId_fkey'
  ) THEN
    ALTER TABLE "GroupMember"
      ADD CONSTRAINT "GroupMember_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GroupMember_userId_fkey'
  ) THEN
    ALTER TABLE "GroupMember"
      ADD CONSTRAINT "GroupMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
