import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

/**
 * Postgres advisory lock (transaction-scoped).
 *
 * This prevents two workers from scoring the same match concurrently.
 *
 * Note: uses hashtext(text) -> int4, then casts to int8 for pg_advisory_xact_lock.
 */
export async function advisoryXactLock(tx: { $executeRaw: any }, key: string) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${key})::bigint);
  `);
}

/**
 * Convenience wrapper for non-transaction contexts.
 */
export async function advisorySessionLock(key: string) {
  await prisma.$executeRaw(Prisma.sql`
    SELECT pg_advisory_lock(hashtext(${key})::bigint);
  `);
}

export async function advisorySessionUnlock(key: string) {
  await prisma.$executeRaw(Prisma.sql`
    SELECT pg_advisory_unlock(hashtext(${key})::bigint);
  `);
}
