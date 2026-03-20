import crypto from "crypto";

export function generateResetToken(): string {
  // 32 bytes -> 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(rawToken: string): string {
  // Store only a hash in DB. If the DB leaks, raw tokens aren't usable.
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
