import { db } from "../db";
import { getEnv, log } from "@fun/core";

/**
 * Retention cleanup — removes editions (and their articles) older than the
 * configured ARCHIVE_RETENTION_DAYS. Idempotent by construction.
 */
export async function cleanupOldData(): Promise<void> {
  const days = getEnv().archiveRetentionDays;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const removed = await db.edition.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  log.info("retention cleanup", { removedEditions: removed.count, retentionDays: days });
}