import cron, { type ScheduledTask } from "node-cron";
import { getEnv, log } from "@telegraph/core";

export type JobContext = {
  signal: "cron" | "startup" | "manual";
};

export type JobHandler<P> = (payload: P, ctx: JobContext) => Promise<void>;

export interface SchedulerHandlers {
  fetch: JobHandler<Record<string, never>>;
  process: JobHandler<Record<string, never>>;
  generateEdition: JobHandler<{ kind: string; date: string }>;
  cleanup: JobHandler<Record<string, never>>;
}

export const EDITION_ORDER = ["MORNING", "AFTERNOON", "EVENING"] as const;

export class Scheduler {
  private tasks: ScheduledTask[] = [];

  constructor(private readonly handlers: SchedulerHandlers) {}

  /** Start all scheduled jobs derived from configuration. */
  start(): void {
    const env = getEnv();

    // Ingestion + processing tick.
    const interval = `*/${Math.max(1, env.fetchIntervalMinutes)} * * * *`;
    this.schedule(interval, () => void this.runSafe("fetch", () => this.handlers.fetch({}, { signal: "cron" })));
    this.schedule(interval, () => void this.runSafe("process", () => this.handlers.process({}, { signal: "cron" })));

    // Edition generation slots (times in env map to MORNING / AFTERNOON / EVENING).
    const times = env.editionTimes.slice(0, EDITION_ORDER.length);
    times.forEach((t, i) => {
      const [h, m] = t.split(":").map((s) => Number.parseInt(s ?? "0", 10));
      const kind = EDITION_ORDER[i] ?? "MORNING";
      const cron = `${m ?? 0} ${h ?? 8} * * *`;
      this.schedule(cron, () => {
        void this.runSafe(`edition:${kind}`, () =>
          this.handlers.generateEdition({ kind, date: todayDate() }, { signal: "cron" }));
      });
    });

    // Daily data retention cleanup (03:05 local).
    this.schedule("5 3 * * *", () => void this.runSafe("cleanup", () => this.handlers.cleanup({}, { signal: "cron" })));

    log.info(`scheduler started: fetch ${interval}, editions ${env.editionTimes.join(", ")}, cleanup 03:05`);
  }

  stop(): void {
    for (const task of this.tasks) task.stop();
    this.tasks = [];
    log.info("scheduler stopped");
  }

  private schedule(expression: string, run: () => void): void {
    this.tasks.push(cron.schedule(expression, run));
  }

  private async runSafe(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      log.error(`job ${name} failed`, { err: err instanceof Error ? err.message : String(err) });
    }
  }
}

export function todayDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export { getEnv };