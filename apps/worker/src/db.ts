import { prisma } from "@telegraph/db";

export const db = prisma();

export async function closeDb(): Promise<void> {
  await db.$disconnect();
}