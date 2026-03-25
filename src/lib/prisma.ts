import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Lightweight visibility: log slow Prisma queries (optional).
const SLOW_MS = Number(process.env.PRISMA_SLOW_QUERY_MS ?? "0");
if (Number.isFinite(SLOW_MS) && SLOW_MS > 0) {
  // Prisma middleware typing varies across Prisma versions/build targets.
  // Use an any-cast to keep this optional instrumentation lightweight.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$use(async (params: any, next: any) => {
    const start = Date.now();
    try {
      return await next(params);
    } finally {
      const ms = Date.now() - start;
      if (ms >= SLOW_MS) {
        console.warn(`[prisma] slow ${ms}ms`, {
          model: params?.model,
          action: params?.action,
        });
      }
    }
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
