import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// apps/backend/scripts -> apps/backend -> apps -> repo root
const backendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendDir, "..", "..");

const srcSchema = path.join(repoRoot, "prisma", "schema.prisma");
const dstDir = path.join(backendDir, "prisma");
const dstSchema = path.join(dstDir, "schema.prisma");

if (!fs.existsSync(srcSchema)) {
  throw new Error(`Prisma schema not found at ${srcSchema}`);
}

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(srcSchema, dstSchema);

console.log(`Copied Prisma schema -> ${dstSchema}`);
