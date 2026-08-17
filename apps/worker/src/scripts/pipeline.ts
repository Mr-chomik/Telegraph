import { getEnv, log } from "@fun/core";
import { registerJobHandlers } from "../jobs";
import { todayDate } from "../scheduler";
import { closeDb } from "../db";

const STEP = (process.argv[2] ?? "all").toLowerCase();

/**
 * Manual pipeline run — one command, no scheduler.
 *   npm run pipeline:run [all|fetch|process|edition]
 * Useful to verify a live fetch → process → edition round-trip on demand.
 */
async function main(): Promise<void> {
  const env = getEnv();
  const steps = STEP === "all" ? ["fetch", "process", "edition"] : [STEP];
  log.info("pipeline:run starting", { steps, driver: env.telegramDriver });

  const handlers = await registerJobHandlers();
  for (const step of steps) {
    log.info(`→ ${step}`);
    if (step === "fetch") await handlers.fetch({}, { signal: "manual" });
    else if (step === "process") await handlers.process({}, { signal: "manual" });
    else if (step === "edition")
      await handlers.generateEdition({ kind: "MORNING", date: todayDate() }, { signal: "manual" });
    else log.error("unknown step", { step });
  }

  await closeDb();
  log.info("pipeline:run complete", { steps });
}

main().catch((err) => {
  log.error("pipeline:run failed", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});