import { getEnv, log } from "@fun/core";
import { startScheduler } from "./runners";

async function main(): Promise<void> {
  const env = getEnv();
  log.info("fun worker starting", {
    nodeEnv: env.nodeEnv,
    aiProvider: env.aiProvider,
    telegramConfigured: env.telegramApiId !== null && env.telegramApiHash !== null,
  });

  // Runner deaths are caught here; the process stays alive for the next tick.
  const scheduler = await startScheduler();
  scheduler.start();

  const shutdown = (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    scheduler.stop();
    setTimeout(() => process.exit(0), 500);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error("worker bootstrap failed", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});