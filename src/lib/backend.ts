import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),
  BACKEND_INTERNAL_TOKEN: z.string().min(20).optional(),
});

const env = envSchema.parse(process.env);

export function getBackendBaseUrl() {
  const base = env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) return null;
  return base.replace(/\/$/, "");
}

export function getBackendInternalAuthHeader() {
  const token = env.BACKEND_INTERNAL_TOKEN;
  if (!token) return null;
  return `Bearer ${token}`;
}
