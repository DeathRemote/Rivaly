import Fastify from "fastify";
import { z } from "zod";

import { prisma } from "./prisma.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  // Prisma reads DATABASE_URL automatically, but validating early makes failures obvious.
  DATABASE_URL: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return {
    ok: true,
    service: "rivaly-backend",
    time: new Date().toISOString(),
  };
});

app.get("/health/db", async () => {
  // Keep it cheap and deterministic. If the DB is unreachable, this will throw.
  await prisma.$queryRaw`SELECT 1`;

  return {
    ok: true,
    db: "ok",
  };
});

app.get("/", async () => {
  return {
    name: "rivaly-backend",
    endpoints: ["GET /health", "GET /health/db"],
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
  };
});

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
