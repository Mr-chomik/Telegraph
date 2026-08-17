import { Prisma } from "@telegraph/db";
import { fetchFreshnessHours, getEnv, isTelegramConfigured, log, normalizePost } from "@telegraph/core";
import { db } from "../db";
import { TelegramManager } from "../telegram/client";
import { PublicPreviewManager } from "../telegram/publicPreview";
import type { JobContext } from "../scheduler";

type FetchManager = {
  resolveChannel(username: string): Promise<ResolvedChannel | null>;
  getMessages(
    username: string,
    limit: number,
  ): Promise<Array<{ id: number; raw: Record<string, unknown>; mediaFiles: string[] }>>;
};

interface ResolvedChannel {
  id: string;
  username: string;
  title: string;
  description: string;
  hasPhoto: boolean;
}

let mtprotoManager: TelegramManager | null = null;
let publicManager: PublicPreviewManager | null = null;

function pickManager(env: ReturnType<typeof getEnv>): FetchManager | null {
  if (env.telegramDriver === "mtproto") {
    if (!isTelegramConfigured(env)) return null;
    mtprotoManager ??= new TelegramManager(env.telegramApiId!, env.telegramApiHash!, env.dataDir);
    return mtprotoManager;
  }
  publicManager ??= new PublicPreviewManager(env.dataDir);
  return publicManager;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Retry a network-dependent Telegram call. t.me connectivity is notoriously
 * flaky (DNS + TCP drops in bursts), so a single failed attempt must not abort
 * the channel. On each failure we wait `delayMs` and retry up to `attempts`
 * times total; the last error propagates.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts: number, delayMs: number, what: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        log.warn(`${what} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`, {
          err: err instanceof Error ? err.message : String(err),
        });
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

/**
 * Telegram ingestion: for every enabled channel, pull the latest posts,
 * normalize them, store raw posts idempotently, download photo media with
 * attribution, and update channel sync state. A failure in one channel never
 * blocks the others, and re-runs never duplicate posts.
 *
 * Two drivers are supported:
 *   - "public" (default): t.me/s/<user> public preview pages — no login at all.
 *   - "mtproto": full-fidelity MTProto session (requires TELEGRAM_API_ID/HASH
 *     and a one-time `npm run tg:login`).
 */
export async function fetchChannelUpdates(
  _payload: Record<string, never>,
  ctx: JobContext,
): Promise<void> {
  const env = getEnv();
  const manager = pickManager(env);
  if (!manager) {
    log.info("fetch skipped — Telegram not configured (set TELEGRAM_API_ID/HASH for MTProto)");
    return;
  }

  // Retry ERROR channels too: fetch is idempotent, and a transient network
  // failure must not permanently disable a channel.
  const channels = await db.channel.findMany({
    where: { enabled: true, status: { in: ["ACTIVE", "VALIDATING", "ERROR"] } },
    orderBy: { priority: "asc" },
    select: { id: true, telegramUsername: true, status: true, lastSyncAt: true },
  });
  if (channels.length === 0) {
    log.info("fetch — no enabled channels to process");
    return;
  }

  for (const channel of channels) {
    try {
      await fetchChannel(manager, channel);
    } catch (err) {
      log.error("fetch failed for channel", {
        channel: channel.telegramUsername,
        err: err instanceof Error ? err.message : String(err),
      });
      await db.channel.update({
        where: { id: channel.id },
        data: { status: "ERROR", lastError: String(err instanceof Error ? err.message : err) },
      });
    }
  }
  log.info(`fetch complete (${ctx.signal})`, { channels: channels.length });
}

async function fetchChannel(manager: FetchManager, channel: {
  id: string;
  telegramUsername: string;
  status: "ACTIVE" | "VALIDATING" | "ERROR" | "DISABLED";
  lastSyncAt: Date | null;
}): Promise<void> {
  const env = getEnv();

  // Only fresh info: 24h back on a channel's first sync, afterwards the
  // interval between editions (the next edition only needs posts since the
  // previous one). Posts without a parseable date are kept (assumed fresh).
  const freshnessHours = fetchFreshnessHours({
    firstRun: channel.lastSyncAt === null,
    editionTimes: env.editionTimes,
  });
  const freshnessCutoff = new Date(Date.now() - freshnessHours * 3_600_000);
  const messageDate = (m: { raw: Record<string, unknown> }): Date | null =>
    m.raw.date ? new Date(String(m.raw.date)) : null;

  // Authoritative validation for channels awaiting confirmation.
  if (channel.status === "VALIDATING") {
    const resolved = await withRetry(
      () => manager.resolveChannel(channel.telegramUsername),
      env.fetchRetries,
      env.fetchRetryDelayMs,
      `resolve ${channel.telegramUsername}`,
    );
    if (!resolved) {
      throw new Error("username does not resolve to a public broadcast channel");
    }
    await db.channel.update({
      where: { id: channel.id },
      data: {
        status: "ACTIVE",
        title: resolved.title,
        description: resolved.description,
        lastError: null,
      },
    });
  }

  const messages = await withRetry(
    () => manager.getMessages(channel.telegramUsername, env.fetchLimit),
    env.fetchRetries,
    env.fetchRetryDelayMs,
    `fetch ${channel.telegramUsername}`,
  );
  const freshMessages = messages.filter((m) => {
    const date = messageDate(m);
    return !date || date.getTime() >= freshnessCutoff.getTime();
  });
  const staleDropped = messages.length - freshMessages.length;
  if (staleDropped > 0) {
    log.info("fetch — dropped stale posts", {
      channel: channel.telegramUsername,
      windowHours: freshnessHours,
      dropped: staleDropped,
      kept: freshMessages.length,
    });
  }
  if (freshMessages.length === 0) {
    await db.channel.update({
      where: { id: channel.id },
      data: { lastSyncAt: new Date(), status: "ACTIVE", lastError: null },
    });
    return;
  }

  const postRows = freshMessages.map((m) => {
    const normalized = normalizePost({
      text: String(m.raw.text ?? ""),
      views: typeof m.raw.views === "number" ? m.raw.views : null,
    });
    const hasPhoto = m.raw.hasPhoto === true;
    return {
      channelId: channel.id,
      telegramMessageId: m.id,
      raw: m.raw as Prisma.InputJsonValue,
      text: normalized.text,
      normalizedText: normalized.normalizedText,
      language: normalized.language,
      views: normalized.views,
      reactions: normalized.reactionsTotal !== null ? { total: normalized.reactionsTotal } : undefined,
      mediaCount: hasPhoto ? Math.max(1, m.mediaFiles.length) : 0,
      // Some channels' t.me/s preview omits per-message <time> elements; fall
      // back to "now" so the post still lands inside the process window.
      publishedAt: m.raw.date ? new Date(String(m.raw.date)) : new Date(),
    };
  });

  await db.telegramPost.createMany({ data: postRows, skipDuplicates: true });

  // Backfill posts persisted before the date fallback (channels without
  // <time> in the preview) so the process job's freshness window sees them.
  await db.telegramPost.updateMany({
    where: { channelId: channel.id, publishedAt: null },
    data: { publishedAt: new Date() },
  });

  // Persist downloaded media rows for posts that carry photos (skip if present).
  for (const m of freshMessages) {
    if (m.mediaFiles.length === 0) continue;
    const post = await db.telegramPost.findUnique({
      where: { channelId_telegramMessageId: { channelId: channel.id, telegramMessageId: m.id } },
      include: { media: { take: 1 } },
    });
    if (!post || post.media.length > 0) continue;
    await db.media.createMany({
      data: m.mediaFiles.map((file, i) => ({
        telegramPostId: post.id,
        kind: "PHOTO",
        remoteId: i === 0 ? "photo" : `photo-${i}`,
        localPath: file,
        attribution: `t.me/${channel.telegramUsername}/${m.id}`,
      })),
    });
  }

  const postCount = await db.telegramPost.count({ where: { channelId: channel.id } });
  await db.channel.update({
    where: { id: channel.id },
    data: { lastSyncAt: new Date(), postCount, status: "ACTIVE", lastError: null },
  });

  log.info("channel synced", {
    channel: channel.telegramUsername,
    fetched: freshMessages.length,
    totalPosts: postCount,
  });
}