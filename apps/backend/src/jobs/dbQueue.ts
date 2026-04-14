import { prisma } from "../prisma.js";
import { JobStatus, JobType, Prisma } from "@prisma/client";

export type EnqueueJobInput = {
  type: JobType;
  dedupeKey?: string | null;
  payload: Prisma.InputJsonValue;
  runAt?: Date;
};

export async function enqueueJob(input: EnqueueJobInput) {
  const runAt = input.runAt ?? new Date();

  // If a dedupeKey is provided, rely on the unique(type,dedupeKey) index.
  // We implement this as an upsert so it is concurrency-safe.
  if (input.dedupeKey) {
    return prisma.job.upsert({
      where: {
        type_dedupeKey: {
          type: input.type,
          dedupeKey: input.dedupeKey,
        },
      },
      create: {
        type: input.type,
        status: JobStatus.QUEUED,
        payload: input.payload,
        dedupeKey: input.dedupeKey,
        runAt,
      },
      update: {
        // If a job is already present, only bring it forward (never delay it).
        runAt,
        status: JobStatus.QUEUED,
        payload: input.payload,
      },
    });
  }

  return prisma.job.create({
    data: {
      type: input.type,
      status: JobStatus.QUEUED,
      payload: input.payload,
      runAt,
    },
  });
}

export async function claimNextJob(lockOwner: string) {
  // Atomic claim using SKIP LOCKED.
  // This avoids multiple workers taking the same job.
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      type: JobType;
      status: JobStatus;
      payload: any;
      dedupeKey: string | null;
      runAt: Date;
      lockedAt: Date | null;
      lockedBy: string | null;
      attempts: number;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    WITH cte AS (
      SELECT id
      FROM "Job"
      WHERE status = ${JobStatus.QUEUED}
        AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "Job" j
    SET
      status = ${JobStatus.RUNNING},
      "lockedAt" = NOW(),
      "lockedBy" = ${lockOwner},
      attempts = attempts + 1,
      "updatedAt" = NOW()
    FROM cte
    WHERE j.id = cte.id
    RETURNING j.*;
  `);

  return rows[0] ?? null;
}

export async function markJobDone(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.DONE, lockedAt: null, lockedBy: null },
  });
}

export async function markJobFailed(jobId: string, err: unknown, nextRunAt?: Date) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError: msg,
      runAt: nextRunAt ?? new Date(),
    },
  });
}
