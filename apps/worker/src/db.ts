import { prisma } from "@fun/db";

export const db = prisma();

export async function closeDb(): Promise<void> {
  await db.$disconnect();
}