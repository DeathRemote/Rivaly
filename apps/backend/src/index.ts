import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import { prisma } from "./prisma.js";
import { registerSwipeRoutes } from "./routes/swipe.js";
import { registerPredictionRoutes } from "./routes/predictions.js";
import { registerTablesRoutes } from "./routes/tables.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerGroupRoutes } from "./routes/groups.js";
import { registerGroupDetailsRoutes } from "./routes/groupDetails.js";
import { registerGroupLeaderboardRoutes } from "./routes/groupLeaderboard.js";
import { registerGroupMatchesRoutes } from "./routes/groupMatches.js";
import { registerGroupTablesRoutes } from "./routes/groupTables.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  // Comma-separated list of allowed origins for browser calls (Vercel domains, etc).
  // Example: https://rivaly.vercel.app,https://rivaly.com
  CORS_ORIGINS: z.string().optional(),
  // Prisma reads DATABASE_URL automatically, but validating early makes failures obvious.
  DATABASE_URL: z.string().min(1).optional(),
  // Shared secret used to validate user JWTs issued by the web app.
  BACKEND_JWT_SECRET: z.string().min(20).optional(),
});

const env = envSchema.parse(process.env);

const app = Fastify({ logger: true });

const allowedOrigins = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser / server-to-server requests (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, false);
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
});

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

app.get("/api/public/ping", async () => {
  return { ok: true };
});

await registerSwipeRoutes(app);
await registerPredictionRoutes(app);
await registerTablesRoutes(app);
await registerDashboardRoutes(app);
await registerGroupRoutes(app);
await registerGroupDetailsRoutes(app);
await registerGroupLeaderboardRoutes(app);
await registerGroupMatchesRoutes(app);
await registerGroupTablesRoutes(app);

app.get("/api/public/competition-seasons/:id", async (req, reply) => {
  const params = z
    .object({
      id: z.string().min(1),
    })
    .parse(req.params);

  const season = await prisma.competitionSeason.findUnique({
    where: { id: params.id },
  });

  if (!season) {
    return reply.code(404).send({ error: "CompetitionSeason not found" });
  }

  return season;
});

app.get("/", async () => {
  return {
    name: "rivaly-backend",
    endpoints: [
      "GET /health",
      "GET /health/db",
      "GET /api/public/ping",
      "GET /api/public/competition-seasons/:id",
      "GET /api/internal/swipe-matches?userId=...",
      "POST /api/internal/predictions",
      "GET /api/internal/table-seasons",
      "GET /api/internal/tables?seasonId=...",
      "GET /api/internal/dashboard",
      "GET /api/internal/groups?tab=my|public",
      "POST /api/internal/groups/join",
      "GET /api/public/invites/:inviteCode",
      "GET /api/internal/groups/:groupId",
      "GET /api/internal/groups/:groupId/leaderboard",
      "GET /api/internal/groups/:groupId/matches",
      "GET /api/internal/groups/:groupId/tables",
    ],
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
    corsOriginsConfigured: allowedOrigins.length > 0,
    backendJwtSecretConfigured: Boolean(env.BACKEND_JWT_SECRET),
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
