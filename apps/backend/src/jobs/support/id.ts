import crypto from "node:crypto";

// We use UUIDs for job + event rows created by the worker.
// Prisma schema uses String ids (often cuid) but UUID strings are safe and unique.
export function uuid() {
  return crypto.randomUUID();
}
