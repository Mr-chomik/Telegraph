import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Archive" };

const KIND_LABELS: Record<string, { ru: string; en: string }> = {
  MORNING: { ru: "Утренний выпуск", en: "Morning edition" },
  AFTERNOON: { ru: "Дневной выпуск", en: "Afternoon edition" },
  EVENING: { ru: "Вечерний выпуск", en: "Evening edition" },
};

export default async function ArchivePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const lang: "ru" | "en" = session.language === "en" ? "en" : "ru";

  const db = prisma();
  const editions = await db.edition.findMany({
    orderBy: { editionDate: "desc" },
    include: { _count: { select: { articles: true } } },
  });

  if (editions.length === 0) {
    return (
      <div className="client-card px-6 py-12 text-center">
        <p className="section-banner mb-6 inline-block px-4 py-1.5">Archive</p>
        <p className="font-ui mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {lang === "en"
            ? "No editions published yet. Run the worker to typeset the paper."
            : "Выпусков пока нет. Запустите воркер, чтобы сверстать газету."}
        </p>
      </div>
    );
  }

  const byDay = new Map<string, typeof editions>();
  for (const e of editions) {
    const day = e.editionDate.toISOString().slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(e);
    byDay.set(day, arr);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-3">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">Archive</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">
          {lang === "en" ? "Past editions" : "Прошедшие выпуски"}
        </h1>
      </header>

      {days.map(([day, list]) => (
        <section key={day}>
          <h2 className="font-ui text-xs uppercase tracking-[0.22em] text-ink-faint">
            {new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(`${day}T12:00:00`))}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {list.map((e) => (
              <Link
                key={e.id}
                href={`/newspaper/${e.id}`}
                className="group block border border-rule bg-paper p-5 transition-all hover:border-rule-dark hover:shadow-[0_1px_0_0_#1c1b17,0_4px_14px_-6px_rgba(28,27,23,0.35)]"
              >
                <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">
                  {KIND_LABELS[e.kind]?.[lang] ?? e.kind}
                </p>
                <h3 className="font-display mt-1 text-xl font-bold text-ink group-hover:underline decoration-rule-dark underline-offset-4">
                  {e.label ?? `${e.kind} edition`}
                </h3>
                <p className="font-ui mt-1 text-sm text-ink-soft">
                  {e.pageCount} pages · {e._count.articles} articles
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}