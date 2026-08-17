import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/api.js";
import { log } from "@fun/core";

export interface ResolvedChannel {
  id: string;
  username: string;
  title: string;
  description: string;
  hasPhoto: boolean;
}

/**
 * Owns the single MTProto connection used by all ingestion work.
 * The session file lives in DATA_DIR so far only one process (the worker)
 * talks to Telegram at a time — the web app never touches MTProto directly.
 */
export class TelegramManager {
  private client: TelegramClient | null = null;
  private readonly sessionPath: string;
  private readonly mediaDir: string;

  constructor(private readonly apiId: number, private readonly apiHash: string, dataDir: string) {
    this.sessionPath = path.join(dataDir, "tg.session");
    this.mediaDir = path.join(dataDir, "media");
    mkdirSync(this.mediaDir, { recursive: true });
  }

  async ensureConnected(): Promise<TelegramClient> {
    if (this.client) return this.client;

    let session = "";
    if (existsSync(this.sessionPath)) {
      try {
        session = readFileSync(this.sessionPath, "utf8").trim();
      } catch {
        session = "";
      }
    }

    const client = new TelegramClient(new StringSession(session), this.apiId, this.apiHash, {
      connectionRetries: 3,
      requestRetries: 2,
      timeout: 30_000,
      autoReconnect: false,
    });

    await client.start({
      phoneNumber: async () => {
        throw new Error(
          "Manual Telegram login is required: no usable session exists. Delete data/tg.session and log in once to authorize.",
        );
      },
      phoneCode: async () => {
        throw new Error("Manual Telegram login required (code).");
      },
      password: async () => {
        throw new Error("Manual Telegram login required (2FA).");
      },
      onError: () => undefined,
    });
    const sessionString = client.session.save() as unknown as string;
    writeFileSync(this.sessionPath, sessionString, "utf8");

    this.client = client;
    log.info("telegram: connected", { apiHashPrefix: this.apiHash.slice(0, 4) });
    return client;
  }

  /** Resolve a public channel by username; returns null when it is not a channel. */
  async resolveChannel(username: string): Promise<ResolvedChannel | null> {
    const client = await this.ensureConnected();
    const entity = await client.getEntity(username);
    if (!(entity instanceof Api.Channel) || entity.megagroup) {
      // Not a broadcast channel (or a supergroup) — skip.
      return null;
    }
    const withAbout = entity as { about?: string };
    return {
      id: String(entity.id),
      username: entity.username ?? username,
      title: entity.title ?? username,
      description: typeof withAbout.about === "string" ? withAbout.about : "",
      hasPhoto: Boolean(entity.photo && entity.photo instanceof Api.ChatPhoto),
    };
  }

  /** Fetch the latest `limit` messages of a public channel. */
  async getMessages(
    channel: string,
    limit: number,
  ): Promise<Array<{ id: number; raw: Record<string, unknown>; mediaFiles: string[] }>> {
    const client = await this.ensureConnected();
    const messages = await client.getMessages(channel, { limit });
    return await Promise.all(
      messages.map(async (m) => ({
        id: m.id,
        raw: buildRaw({
          id: m.id,
          date: m.date,
          message: m.message ?? undefined,
          views: typeof m.views === "number" ? m.views : undefined,
          forwards: typeof m.forwards === "number" ? m.forwards : undefined,
          hasPhoto: Boolean(m.photo),
        }),
        mediaFiles: await this.saveMedia(channel, m),
      })),
    );
  }

  private async saveMedia(channel: string, m: { id: number; photo?: unknown }): Promise<string[]> {
    if (!m.photo) return [];
    try {
      const client = await this.ensureConnected();
      const filePath = path.join(this.mediaDir, `${channel}_${m.id}.jpg`);
      if (existsSync(filePath)) return [filePath];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).downloadMedia(m.photo, { outputFile: filePath });
      return existsSync(filePath) ? [filePath] : [];
    } catch (err) {
      log.warn("telegram: media download skipped", { channel, err: String(err) });
      return [];
    }
  }

  async close(): Promise<void> {
    try {
      await this.client?.disconnect();
    } catch {
      // ignore
    }
    this.client = null;
  }
}

function buildRaw(m: {
  id: number;
  date: Date | number | string | undefined;
  message?: string;
  views?: number;
  forwards?: number;
  hasPhoto?: boolean;
}): Record<string, unknown> {
  return {
    type: "message",
    id: m.id,
    date: m.date === undefined ? null : toIsoDate(m.date),
    text: m.message ?? "",
    views: m.views ?? null,
    forwards: m.forwards ?? null,
    hasPhoto: Boolean(m.hasPhoto),
  };
}

function toIsoDate(value: Date | number | string): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number") {
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}