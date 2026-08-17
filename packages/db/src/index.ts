import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@telegraph/core";
import { PrismaClient } from "../generated/prisma/client";

const cached = globalThis as unknown as { __funPrisma?: PrismaClient };

export function createPrismaClient(connectionString?: string): PrismaClient {
  const databaseUrl = connectionString ?? getEnv().databaseUrl;
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function prisma(): PrismaClient {
  if (!cached.__funPrisma) {
    cached.__funPrisma = createPrismaClient();
  }
  return cached.__funPrisma;
}

export * from "../generated/prisma/client";