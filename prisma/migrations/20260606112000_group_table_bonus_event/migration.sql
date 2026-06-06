-- Add new enum values for bonus scoring.
-- Prisma does not manage enum value additions automatically without a DB connection.
-- This migration is safe + idempotent.

ALTER TYPE "SeasonPointsEventType" ADD VALUE IF NOT EXISTS 'GROUP_TABLE_BONUS';
ALTER TYPE "PointsEventType" ADD VALUE IF NOT EXISTS 'GROUP_TABLE_BONUS';
