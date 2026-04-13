import { z } from "zod";

const envSchema = z.object({
  INTERNAL_API_TOKEN: z.string().min(20).optional(),
});

const env = envSchema.parse(process.env);

export function requireInternalAuth(authHeader: string | undefined) {
  const token = env.INTERNAL_API_TOKEN;
  if (!token) {
    // If not configured, fail closed.
    throw Object.assign(new Error("INTERNAL_API_TOKEN is not configured"), { statusCode: 500 });
  }

  const expected = `Bearer ${token}`;
  if (!authHeader || authHeader !== expected) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
}
