export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

interface LoggerOptions {
  minLevel?: LogLevel;
  prefix?: string;
}

export class Logger {
  private readonly minRank: number;
  private readonly prefix: string;

  constructor(opts: LoggerOptions = {}) {
    this.minRank = LEVEL_RANK[opts.minLevel ?? "info"];
    this.prefix = opts.prefix ?? "";
  }

  child(prefix: string): Logger {
    return new Logger({
      minLevel: this.levelName,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
    });
  }

  private get levelName(): LogLevel {
    if (this.minRank <= 10) return "debug";
    if (this.minRank <= 20) return "info";
    if (this.minRank <= 30) return "warn";
    return "error";
  }

  debug(msg: string, meta?: unknown): void {
    this.write("debug", msg, meta);
  }

  info(msg: string, meta?: unknown): void {
    this.write("info", msg, meta);
  }

  warn(msg: string, meta?: unknown): void {
    this.write("warn", msg, meta);
  }

  error(msg: string, meta?: unknown): void {
    this.write("error", msg, meta);
  }

  private write(level: LogLevel, msg: string, meta?: unknown): void {
    if (LEVEL_RANK[level] < this.minRank) return;
    const ts = new Date().toISOString();
    const prefix = this.prefix ? ` [${this.prefix}]` : "";
    const metaStr = meta === undefined ? "" : ` ${safeJson(meta)}`;
    const line = `${ts} ${level.toUpperCase().padEnd(5)}${prefix} ${msg}${metaStr}`;
    if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = new Logger({ minLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info" });