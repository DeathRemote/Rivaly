-- Add Group.sport + Group.inviteCode, and rework GroupMember primary key to an id

-- CreateEnum (Sport)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Sport') THEN
    CREATE TYPE "Sport" AS ENUM ('SOCCER', 'BASKETBALL', 'TENNIS', 'ESPORTS');
  END IF;
END $$;

-- Group: add sport + inviteCode
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "sport" "Sport";
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;

-- Backfill for existing rows (if any)
UPDATE "Group" SET "sport" = 'SOCCER' WHERE "sport" IS NULL;

-- inviteCode backfill (temporary). We'll enforce NOT NULL + unique after backfill.
-- Use a short deterministic-ish code for existing groups if any.
UPDATE "Group" SET "inviteCode" = UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8)) WHERE "inviteCode" IS NULL;

-- Enforce constraints
ALTER TABLE "Group" ALTER COLUMN "sport" SET NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "inviteCode" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Group_inviteCode_key'
  ) THEN
    CREATE UNIQUE INDEX "Group_inviteCode_key" ON "Group"("inviteCode");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Group_sport_idx'
  ) THEN
    CREATE INDEX "Group_sport_idx" ON "Group"("sport");
  END IF;
END $$;

-- GroupMember: add id + createdAt, change PK to id, add unique(groupId,userId)
ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS "id" TEXT;
ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

-- If old schema had joinedAt, rename to createdAt
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'GroupMember' AND column_name = 'joinedAt'
  ) THEN
    -- rename joinedAt -> createdAt (if createdAt isn't already there)
    BEGIN
      ALTER TABLE "GroupMember" RENAME COLUMN "joinedAt" TO "createdAt";
    EXCEPTION WHEN duplicate_column THEN
      -- ignore
    END;
  END IF;
END $$;

-- Backfill id and createdAt
UPDATE "GroupMember" SET "id" = COALESCE("id", CONCAT('gm_', UPPER(SUBSTRING(REPLACE("groupId", '-', ''), 1, 4)), UPPER(SUBSTRING(REPLACE("userId", '-', ''), 1, 4)), UPPER(SUBSTRING(MD5(random()::text), 1, 6))))
WHERE "id" IS NULL;

UPDATE "GroupMember" SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "createdAt" IS NULL;

-- Set defaults/constraints
ALTER TABLE "GroupMember" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "GroupMember" ALTER COLUMN "createdAt" SET NOT NULL;

-- Drop old composite PK if it exists, then set new PK on id
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = '"GroupMember"'::regclass AND contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "GroupMember" DROP CONSTRAINT %I', pk_name);
  END IF;

  -- Create PK on id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"GroupMember"'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- Unique constraint on (groupId,userId)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'GroupMember_groupId_userId_key'
  ) THEN
    CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
  END IF;
END $$;
