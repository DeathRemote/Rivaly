import Fastify from "fastify";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0")
});

const env = envSchema.parse(process.env);

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return {
    ok: true,
    service: "rivaly-backend",
    time: new Date().toISOString()
  };
});

app.get("/", async () => {
  return {
    name: "rivaly-backend",
    endpoints: ["GET /health"]
  };
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
