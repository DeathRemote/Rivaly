import { PrismaClient } from "@prisma/client";

// In production, you may want to tune logging and connection behavior.
// For now, keep it minimal and reliable.
export const prisma = new PrismaClient();
