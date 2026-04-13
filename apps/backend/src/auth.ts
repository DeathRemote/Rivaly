import { z } from "zod";
import { jwtVerify } from "jose";

const envSchema = z.object({
  BACKEND_JWT_SECRET: z.string().min(20).optional(),
});

const env = envSchema.parse(process.env);

export async function requireUserAuth(authHeader: string | undefined): Promise<{ userId: string }> {
  const secret = env.BACKEND_JWT_SECRET;
  if (!secret) {
    // If not configured, fail closed.
    throw Object.assign(new Error("BACKEND_JWT_SECRET is not configured"), { statusCode: 500 });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "rivaly-web",
      audience: "rivaly-backend",
    });

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) throw new Error("Missing sub");

    return { userId };
  } catch {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
}
