/**
 * Seed — base data for Fun.
 *
 * Creates: default categories, a set of real public Telegram channels, and a
 * demo admin user. No placeholder posts are generated: live articles come from
 * the worker's fetch job (public t.me preview or MTProto).
 *
 * Run: `npm -w @fun/db run db:seed:demo`
 */
import { hash } from "bcryptjs";
import { prisma } from "../src/index";

// Real, publicly-readable broadcast channels verified to work with the
// public-preview driver (t.me/s/<user>). Titles are taken from the channels.
const REAL_CHANNELS = [
  { username: "bbbreaking", title: "Раньше всех. Ну почти.", category: "main", priority: 1, isDefault: true },
  { username: "rbc_news", title: "РБК. Новости. Главное", category: "business", priority: 2, isDefault: true },
  { username: "readovkanews", title: "Readovka", category: "russia", priority: 3, isDefault: true },
  { username: "tjournal", title: "TJ", category: "tech", priority: 2, isDefault: true },
  { username: "nplus1", title: "Наука и технологии", category: "science", priority: 3, isDefault: true },
  { username: "sportexpress", title: "Спорт-Экспресс", category: "sports", priority: 4, isDefault: true },
  { username: "kinopoisk", title: "Кинопоиск", category: "culture", priority: 4, isDefault: true },
  { username: "mash", title: "Mash", category: "misc", priority: 5, isDefault: true },
  { username: "banksta", title: "Банкста", category: "business", priority: 6, isDefault: true },
];

async function main(): Promise<void> {
  const db = prisma();

  const categories = [
    { key: "main", slug: "main", nameRu: "Главные", nameEn: "Main News", sortOrder: 1, weight: 1.4 },
    { key: "world", slug: "world", nameRu: "Мир", nameEn: "World", sortOrder: 2, weight: 1.1 },
    { key: "europe", slug: "europe", nameRu: "Европа", nameEn: "Europe", sortOrder: 3, weight: 1.0 },
    { key: "russia", slug: "russia", nameRu: "Россия", nameEn: "Russia", sortOrder: 4, weight: 1.1 },
    { key: "tech", slug: "technology", nameRu: "Технологии", nameEn: "Technology", sortOrder: 5, weight: 1.2 },
    { key: "science", slug: "science", nameRu: "Наука", nameEn: "Science", sortOrder: 6, weight: 1.0 },
    { key: "business", slug: "business", nameRu: "Бизнес", nameEn: "Business", sortOrder: 7, weight: 1.1 },
    { key: "games", slug: "games", nameRu: "Игры", nameEn: "Games", sortOrder: 8, weight: 0.9 },
    { key: "sports", slug: "sports", nameRu: "Спорт", nameEn: "Sports", sortOrder: 9, weight: 0.9 },
    { key: "culture", slug: "culture", nameRu: "Культура", nameEn: "Culture", sortOrder: 10, weight: 0.8 },
    { key: "humor", slug: "light-reading", nameRu: "Лёгкое чтение", nameEn: "Light Reading", sortOrder: 11, weight: 0.4 },
    { key: "misc", slug: "miscellaneous", nameRu: "Разное", nameEn: "Miscellaneous", sortOrder: 12, weight: 0.5 },
  ];

  for (const c of categories) {
    await db.category.upsert({
      where: { key: c.key },
      update: { nameRu: c.nameRu, nameEn: c.nameEn, sortOrder: c.sortOrder, importanceWeight: c.weight },
      create: {
        key: c.key,
        slug: c.slug,
        nameRu: c.nameRu,
        nameEn: c.nameEn,
        sortOrder: c.sortOrder,
        importanceWeight: c.weight,
        isDefault: true,
        enabled: true,
      },
    });
  }

  for (const ch of REAL_CHANNELS) {
    const category = await db.category.findUnique({ where: { key: ch.category } });
    await db.channel.upsert({
      where: { telegramUsername: ch.username },
      update: {
        title: ch.title,
        categoryId: category?.id,
        priority: ch.priority,
        isDefaultSource: ch.isDefault,
        enabled: true,
      },
      create: {
        telegramUsername: ch.username,
        title: ch.title,
        categoryId: category?.id,
        priority: ch.priority,
        isDefaultSource: ch.isDefault,
        enabled: true,
      },
    });
  }

  // Demo admin account (email/password shown in README for local demos only).
  const passwordHash = await hash("demo1234", 12);
  await db.user.upsert({
    where: { email: "demo@fun.app" },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email: "demo@fun.app",
      name: "Demo Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Subscribe the demo user to every source (weight 5 = standard) so the
  // personal digest and the source-mix settings have a sensible default.
  const demoUser = await db.user.findUnique({ where: { email: "demo@fun.app" } });
  if (demoUser) {
    const allChannelIds = await db.channel.findMany({ select: { id: true } });
    await db.channelSubscription.createMany({
      data: allChannelIds.map((c) => ({ userId: demoUser.id, channelId: c.id, weight: 5, enabled: true })),
      skipDuplicates: true,
    });
  }

  console.log(
    "Seed complete:",
    JSON.stringify(
      {
        categories: await db.category.count(),
        channels: await db.channel.count(),
        totalPosts: await db.telegramPost.count(),
      },
      null,
      2,
    ),
  );
  console.log("Demo account: demo@fun.app / demo1234");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
