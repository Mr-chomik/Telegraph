import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { getEnv, log } from "@fun/core";

const prompt = (rl: ReturnType<typeof createInterface>, q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

/**
 * One-time interactive login. Saves the MTProto session to DATA_DIR/tg.session,
 * which the worker reuses for all later (fully headless) collection runs.
 * Run once:  npm run tg:login   (enter phone, then the code from Telegram).
 */
async function main(): Promise<void> {
  const env = getEnv();
  if (env.telegramApiId === null || env.telegramApiHash === null) {
    log.error("TELEGRAM_API_ID / TELEGRAM_API_HASH are not configured in .env");
    process.exit(1);
  }

  const sessionPath = path.join(env.dataDir, "tg.session");
  mkdirSync(env.dataDir, { recursive: true });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const phone = (await prompt(rl, "Phone (international, e.g. +79001234567): ")).trim();
  if (!phone) {
    console.error("phone number required");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), env.telegramApiId, env.telegramApiHash, {
    connectionRetries: 3,
    requestRetries: 2,
    timeout: 30_000,
  });

  try {
    await client.start({
      phoneNumber: async () => phone,
      password: async () => (await prompt(rl, "2FA password (if any, else Enter): ")).trim(),
      phoneCode: async () => (await prompt(rl, "Code from Telegram: ")).trim(),
      onError: (err) => console.error("login step error:", err),
    });
    console.log("logged in as", (await client.getMe()).username ?? "user");
  } finally {
    rl.close();
  }

  writeFileSync(sessionPath, (client.session.save() as unknown as string).toString(), "utf8");
  log.info("session saved", { sessionPath });
  console.log("\nDone. The worker can now collect from Telegram headlessly.");
  await client.disconnect();
}

main().catch((err) => {
  log.error("login failed", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});