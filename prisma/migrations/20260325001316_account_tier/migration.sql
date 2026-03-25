-- Add account tier / plan separate from role (admin permissions)

DO $$ BEGIN
  CREATE TYPE "AccountTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'ELITE', 'FRIENDS_AND_FAMILY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accountTier" "AccountTier" NOT NULL DEFAULT 'FREE';
