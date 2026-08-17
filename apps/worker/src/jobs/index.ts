import type { JobHandler } from "../scheduler";

export interface RegisteredJobs {
  fetch: JobHandler<Record<string, never>>;
  process: JobHandler<Record<string, never>>;
  generateEdition: JobHandler<{ kind: string; date: string }>;
  cleanup: JobHandler<Record<string, never>>;
}

export async function registerJobHandlers(): Promise<RegisteredJobs> {
  // Job implementations land in M2 (fetch) and M3 (process/generateEdition).
  // Handlers must be idempotent and isolated: a failure in one job never
  // prevents the next scheduled run.
  const { fetchChannelUpdates } = await import("./fetch");
  const { processNewPosts } = await import("./process");
  const { generateEdition } = await import("./generateEdition");
  const { cleanupOldData } = await import("./cleanup");

  return {
    fetch: fetchChannelUpdates,
    process: processNewPosts,
    generateEdition: generateEdition as JobHandler<{ kind: string; date: string }>,
    cleanup: cleanupOldData,
  };
}