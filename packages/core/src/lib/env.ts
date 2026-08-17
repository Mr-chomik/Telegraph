import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

export interface AppEnv {
  databaseUrl: string;
  sessionSecret: string;
  adminEmails: string[];
  defaultLanguage: string;
  telegramApiId: number | null;
  telegramApiHash: string | null;
  telegramDriver: "public" | "mtproto";
  dataDir: string;
  mediaDir: string;
  fetchIntervalMinutes: number;
  fetchLimit: number;
  fetchRetries: number;
  fetchRetryDelayMs: number;
  aiProvider: "none" | "ollama";
  aiMode: "off" | "light" | "full";
  ollamaBaseUrl: string;
  localModel: string;
  editionTimes: string[];
  archiveRetentionDays: number;
  editionWindowHours: number;
  nodeEnv: string;
}

export function repoRoot(): string {
  // Walk up from packages/core/src/lib until we hit the monorepo root
  // (the package.json that declares `workspaces`). The naive ../../.. is off
  // by one level, so the relative approach silently failed to load `.env`.
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const json = JSON.parse(readFileSync(manifest, "utf8")) as { workspaces?: unknown };
        if (Array.isArray(json.workspaces)) return dir;
      } catch {
        // malformed manifest — keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("could not locate monorepo root");
    dir = parent;
  }
}

let loaded = false;

export function loadDotEnv(): void {
  if (loaded) return;
  const envPath = path.join(repoRoot(), ".env");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  loaded = true;
}

const toInt = (v: string | undefined, fallback: number): number => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBoolLikeList = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Resolve a data/media dir to an absolute path under the monorepo root. */
function resolveDir(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot(), p);
}

export function getEnv(overrides: NodeJS.ProcessEnv = process.env): AppEnv {
  loadDotEnv();
  const e = { ...process.env, ...overrides };
  const apiIdRaw = e.TELEGRAM_API_ID?.trim();
  const dataDir = e.DATA_DIR ?? "./data";
  return {
    databaseUrl: e.DATABASE_URL ?? "postgresql://fun:fun@localhost:5432/fun?schema=public",
    sessionSecret: e.SESSION_SECRET ?? "dev-only-insecure-secret",
    adminEmails: toBoolLikeList(e.ADMIN_EMAILS),
    defaultLanguage: e.DEFAULT_LANGUAGE === "en" ? "en" : "ru",
    telegramApiId: apiIdRaw && /^\d+$/.test(apiIdRaw) ? Number.parseInt(apiIdRaw, 10) : null,
    telegramApiHash: e.TELEGRAM_API_HASH?.trim() || null,
    telegramDriver: e.TELEGRAM_DRIVER === "mtproto" ? "mtproto" : "public",
    dataDir: resolveDir(dataDir),
    mediaDir: resolveDir(e.MEDIA_DIR ?? `${dataDir}/media`),
    fetchIntervalMinutes: toInt(e.FETCH_INTERVAL_MINUTES, 15),
    fetchLimit: toInt(e.FETCH_LIMIT, 25),
    fetchRetries: toInt(e.FETCH_RETRIES, 3),
    fetchRetryDelayMs: toInt(e.FETCH_RETRY_DELAY_MS, 15000),
    aiProvider: e.AI_PROVIDER === "ollama" ? "ollama" : "none",
    aiMode: e.AI_MODE === "full" ? "full" : e.AI_MODE === "light" ? "light" : "off",
    ollamaBaseUrl: e.OLLAMA_BASE_URL ?? "http://localhost:11434",
    localModel: e.LOCAL_MODEL ?? "qwen2.5:7b",
    editionTimes: toBoolLikeList(e.EDITION_TIMES).length
      ? toBoolLikeList(e.EDITION_TIMES)
      : ["08:00", "13:00", "19:00"],
    archiveRetentionDays: toInt(e.ARCHIVE_RETENTION_DAYS, 30),
    editionWindowHours: toInt(e.EDITION_WINDOW_HOURS, 12),
    nodeEnv: e.NODE_ENV ?? "development",
  };
}

export function isTelegramConfigured(env: AppEnv): boolean {
  return env.telegramApiId !== null && env.telegramApiHash !== null;
}