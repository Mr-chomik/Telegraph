import { execSync } from "node:child_process";
import path from "node:path";
import { prisma, type PrismaClient } from "@telegraph/db";
import { registerJobHandlers } from "../apps/worker/src/jobs";
import { todayDate } from "../apps/worker/src/scheduler";

const ROOT = path.resolve(__dirname, "..");
const run = (cmd: string): void => execSync(cmd, { cwd: ROOT, stdio: "inherit" });

interface TestPostInput {
  channel: string;
  messageId: number;
  text: string;
  minutesAgo: number;
  views?: number;
  adScore?: number;
}

// Deterministic posts for the e2e suite (the seed itself adds no posts).
function makeTestPosts(): TestPostInput[] {
  const posts: TestPostInput[] = [];
  let id = 1;

  // Major event repeated across 5 channels (story clustering training data).
  const majorEvent = [
    "Правительство анонсировало новый национальный проект.",
    "Запуск нового исследовательского спутника прошёл успешно.",
    "Трансляция продолжится в прямом эфире, подробности позже.",
  ].join("\n");
  for (const ch of ["bbbreaking", "rbc_news", "readovkanews", "tjournal", "nplus1"]) {
    posts.push({ channel: ch, messageId: id++, text: majorEvent, minutesAgo: 90, views: 4000 });
  }

  // Second repeated event across 3 channels.
  const secondEvent = "Новые правила вступают в силу с понедельника.\nБизнес готовится к изменениям.";
  for (const ch of ["bbbreaking", "rbc_news", "readovkanews"]) {
    posts.push({ channel: ch, messageId: id++, text: secondEvent, minutesAgo: 240, views: 2000 });
  }

  // Unique stories per channel (covers "закон" for the full-text search test).
  const unique: Array<[string, number, string]> = [
    ["bbbreaking", 200, "Сводка дня: Правительство внесло закон о цифровых технологиях в Госдуму."],
    ["tjournal", 150, "Обзор нового смартфона: компания показала устройство с гибким экраном."],
    ["tjournal", 130, "Открыт исходный код утилиты для управления системой."],
    ["nplus1", 120, "Учёные опубликовали результаты исследования о марсианском грунте."],
    ["sportexpress", 100, "Сборная выиграла матч: итоги турнира и голы тура."],
    ["kinopoisk", 60, "Вышел новый фильм: премьера в кинотеатрах страны."],
    ["banksta", 180, "Курс валют и итоги недели: рынок ждёт решения регулятора."],
    ["mash", 40, "Кот забрался в офис новостного агентства и «отредактировал» статью."],
  ];
  for (const [channel, minutesAgo, text] of unique) {
    posts.push({ channel, messageId: id++, text, minutesAgo, views: 1500 });
  }

  // Spam example (should be rejected by the pipeline).
  posts.push({
    channel: "rbc_news",
    messageId: id++,
    text: "Купите супер-скидки! 90% выгода всем! Перейдите по ссылке и получите бонус!",
    minutesAgo: 20,
    views: 200,
    adScore: 95,
  });

  return posts;
}

async function insertTestPosts(db: PrismaClient): Promise<void> {
  const channelIdByUsername = new Map<string, string>();
  const channels = await db.channel.findMany({ select: { id: true, telegramUsername: true } });
  for (const c of channels) channelIdByUsername.set(c.telegramUsername, c.id);

  const rows = makeTestPosts().map((p) => ({
    channelId: channelIdByUsername.get(p.channel)!,
    telegramMessageId: p.messageId,
    raw: { type: "test", id: p.messageId, text: p.text, date: new Date() } as object,
    text: p.text,
    publishedAt: new Date(Date.now() - p.minutesAgo * 60_000),
    mediaCount: 0,
    views: p.views ?? null,
    adScore: p.adScore ?? null,
  }));
  await db.telegramPost.createMany({ data: rows });
  console.log(`[setup-data] inserted ${rows.length} test posts`);
}

async function main(): Promise<void> {
  const db = prisma();

  console.log("[setup-data] resetting database schema…");
  await db.$executeRawUnsafe("DROP SCHEMA public CASCADE");
  await db.$executeRawUnsafe("CREATE SCHEMA public");
  await db.$disconnect();

  console.log("[setup-data] applying migrations…");
  run("npm -w @telegraph/db run db:deploy");

  console.log("[setup-data] seeding demo data…");
  run("npm run db:seed:demo");

  console.log("[setup-data] inserting deterministic test posts…");
  await insertTestPosts(db);

  console.log("[setup-data] running process job…");
  const handlers = await registerJobHandlers();
  await handlers.process({}, { signal: "manual" });

  console.log("[setup-data] running generateEdition job…");
  await handlers.generateEdition({ kind: "MORNING", date: todayDate() }, { signal: "manual" });

  // Pin the demo account to English so the e2e suite is deterministic.
  const demo = await db.user.findUnique({ where: { email: "demo@telegraph.app" } });
  if (demo) {
    await db.userPreference.upsert({
      where: { userId: demo.id },
      update: { language: "en" },
      create: { userId: demo.id, language: "en" },
    });
  }

  await db.$disconnect();
  console.log("[setup-data] done");
}

main().catch((err) => {
  console.error("[setup-data] failed", err);
  process.exit(1);
});