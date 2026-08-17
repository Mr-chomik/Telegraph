import { prisma } from "@fun/db";
import { registerJobHandlers } from "../apps/worker/src/jobs";
import { todayDate } from "../apps/worker/src/scheduler";

async function main(): Promise<void> {
  const handlers = await registerJobHandlers();

  console.log("[setup-jobs] running process job…");
  await handlers.process({}, { signal: "manual" });

  console.log("[setup-jobs] running generateEdition job…");
  await handlers.generateEdition(
    { kind: "MORNING", date: todayDate() },
    { signal: "manual" },
  );

  // Pin the demo account to English so the e2e suite is deterministic.
  const db = prisma();
  const demo = await db.user.findUnique({ where: { email: "demo@fun.app" } });
  if (demo) {
    await db.userPreference.upsert({
      where: { userId: demo.id },
      update: { language: "en" },
      create: { userId: demo.id, language: "en" },
    });
  }

  await db.$disconnect();
  console.log("[setup-jobs] done");
}

main().catch((err) => {
  console.error("[setup-jobs] failed", err);
  process.exit(1);
});