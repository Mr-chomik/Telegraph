import { prisma } from "@telegraph/db";
import { log } from "@telegraph/core";
import { Scheduler } from "./scheduler";
import { registerJobHandlers } from "./jobs";

export async function startScheduler(): Promise<Scheduler> {
  const handlers = await registerJobHandlers();
  const scheduler = new Scheduler(handlers);
  await healthCheck();
  return scheduler;
}

async function healthCheck(): Promise<void> {
  const db = prisma();
  try {
    await db.$queryRaw`SELECT 1`;
    log.info("database connectivity: ok");
  } catch (err) {
    log.error("database connectivity: FAILED — worker will retry on next tick", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}