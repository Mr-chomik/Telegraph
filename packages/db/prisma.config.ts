import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Loaded from .env (root) above; fallback keeps `prisma generate` working
    // when no database is configured yet (e.g. image builds).
    url: process.env.DATABASE_URL ?? "postgresql://fun:fun@localhost:5432/fun",
  },
});