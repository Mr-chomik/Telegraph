import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Editor's desk" };

const JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCEEDED: "Done",
  FAILED: "Failed",
};

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");
  const lang: "ru" | "en" = session.language === "en" ? "en" : "ru";

  const db = prisma();
  const [channels, posts, stories, editions, runningJobs, editionsByStatus, editionsRecent, jobsRecent, channelsList, storiesByCategory] =
    await Promise.all([
      db.channel.count(),
      db.telegramPost.count(),
      db.story.count(),
      db.edition.count(),
      db.processingJob.count({ where: { status: "RUNNING" } }),
      db.edition.groupBy({ by: ["status"], _count: true }),
      db.edition.findMany({ orderBy: { editionDate: "desc" }, take: 5 }),
      db.processingJob.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
      db.channel.findMany({
        orderBy: [{ priority: "asc" }, { title: "asc" }],
        include: { category: true, _count: { select: { posts: true } } },
        take: 12,
      }),
      db.story.groupBy({ by: ["categoryId"], _count: true }),
    ]);

  const stats = [
    { label: "Channels", value: channels },
    { label: "Posts ingested", value: posts },
    { label: "Stories", value: stories },
    { label: "Editions", value: editions },
    { label: "Running jobs", value: runningJobs },
  ];

  return (
    <div className="space-y-10">
      <header className="border-b border-rule pb-3">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">{lang === "en" ? "Editor's desk" : "Редакция"}</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">
          {lang === "en" ? "Operations dashboard" : "Панель работы газеты"}
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="client-card px-4 py-3">
            <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">{s.label}</p>
            <p className="font-display mt-1 text-3xl font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title={lang === "en" ? "Latest editions" : "Последние выпуски"}>
          <ul className="divide-y divide-rule">
            {editionsRecent.length === 0 && (
              <li className="py-3 font-ui text-sm text-ink-faint">
                {lang === "en" ? "Nothing typeset yet" : "Пока ничего не свёрстано"}
              </li>
            )}
            {editionsRecent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/newspaper/${e.id}`} className="font-display text-sm font-bold text-ink hover:underline decoration-rule-dark underline-offset-2">
                  {e.label ?? `${e.kind} edition`}
                </Link>
                <span className="font-ui text-xs text-ink-faint">
                  {e.status} · {e.pageCount}p
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={lang === "en" ? "Recent jobs" : "Последние задачи"}>
          <ul className="divide-y divide-rule">
            {jobsRecent.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-ui text-sm text-ink">
                    {j.type}
                    {j.error ? (
                      <span className="text-accent"> — {j.error}</span>
                    ) : null}
                  </p>
                  <p className="font-ui text-xs text-ink-faint">
                    {j.startedAt ? j.startedAt.toLocaleString() : "—"}
                  </p>
                </div>
                <StatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={lang === "en" ? "Channels" : "Каналы"}>
          <ul className="divide-y divide-rule">
            {channelsList.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-body truncate text-sm text-ink">{c.title ?? c.telegramUsername}</p>
                  <p className="font-ui text-xs text-ink-faint">
                    {c.category?.key ?? "—"} · {c.priority} · {c._count.posts} posts
                  </p>
                </div>
                <span className={`font-ui shrink-0 text-xs ${c.enabled ? "text-ink-soft" : "text-ink-faint"}`}>
                  {c.enabled ? "ON" : "OFF"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={lang === "en" ? "Stories by category" : "Истории по категориям"}>
          <ul className="divide-y divide-rule">
            {storiesByCategory.map((s) => (
              <li key={s.categoryId ?? "none"} className="flex items-center justify-between py-2">
                <span className="font-ui text-sm text-ink-soft">{s.categoryId ?? "—"}</span>
                <span className="font-display text-sm font-bold text-ink">{s._count}</span>
              </li>
            ))}
          </ul>
          <div className="font-ui mt-4 text-xs text-ink-faint">
            {editionsByStatus
              .map((s) => `${s.status} ${s._count}`)
              .join(" · ") || "no editions"}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="client-card px-5 py-4">
      <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "SUCCEEDED"
      ? "text-ink-soft"
      : status === "FAILED"
        ? "text-accent"
        : status === "RUNNING"
          ? "text-ink"
          : "text-ink-faint";
  return <span className={`font-ui shrink-0 text-xs font-bold uppercase tracking-wider ${tone}`}>{JOB_STATUS_LABEL[status] ?? status}</span>;
}