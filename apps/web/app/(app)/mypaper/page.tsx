import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@telegraph/db";
import { sectionLabel } from "@/components/newspaper/section-labels";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Newspaper" };

const CONTENT_CAPS: Record<string, number> = { light: 12, normal: 24, full: 60 };

export default async function MyNewspaperPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const lang: "ru" | "en" = session.language === "en" ? "en" : "ru";

  const db = prisma();
  const prefs = await db.userPreference.findUnique({ where: { userId: session.id } });
  const humorEnabled = prefs?.humorEnabled ?? true;
  const contentAmount = (prefs?.contentAmount as "light" | "normal" | "full") ?? "normal";
  const cap = CONTENT_CAPS[contentAmount] ?? CONTENT_CAPS.normal;
  const enabledKeys = prefs?.enabledCategoryKeys;
  const enabledSections = Array.isArray(enabledKeys)
    ? new Set(enabledKeys as string[])
    : null;

  // Per-source weighting: how much of each channel flows into the digest.
  const subscriptions = await db.channelSubscription.findMany({
    where: { userId: session.id },
    select: { channelId: true, weight: true, enabled: true },
  });
  const weightByChannel = new Map<string, number>();
  for (const s of subscriptions) {
    weightByChannel.set(s.channelId, s.enabled ? s.weight : 0);
  }
  const DEFAULT_WEIGHT = 5;
  const weightOf = (channelId: string | null | undefined): number => {
    if (!channelId) return DEFAULT_WEIGHT;
    return weightByChannel.get(channelId) ?? DEFAULT_WEIGHT;
  };

  const edition = await db.edition.findFirst({
    orderBy: { editionDate: "desc" },
    include: {
      articles: {
        orderBy: [{ page: "asc" }, { pageOrder: "asc" }],
        select: {
          id: true,
          page: true,
          pageOrder: true,
          section: true,
          headline: true,
          summary: true,
          format: true,
          layout: true,
          story: {
            select: {
              posts: { select: { post: { select: { channelId: true } } } },
            },
          },
        },
      },
      _count: { select: { articles: true } },
    },
  });

  if (!edition) {
    return (
      <div className="client-card px-6 py-12 text-center">
        <p className="section-banner mb-6 inline-block px-4 py-1.5">My Newspaper</p>
        <p className="font-ui mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {lang === "en" ? "Nothing to show yet — run the worker to typeset an edition." : "Показывать нечего — запустите воркер, чтобы сверстать выпуск."}
        </p>
      </div>
    );
  }

  const articles = edition.articles
    .map((a) => {
      const layout = (a.layout ?? {}) as { kind?: string };
      const isLight = a.section === "light-reading" || layout.kind === "light-reading";
      if (isLight && !humorEnabled) return null;
      if (enabledSections && !enabledSections.has(a.section) && a.section !== "front-page") return null;
      // Weight = strongest of the story's sources in this user's subscription.
      const channels = a.story?.posts.map((p) => p.post.channelId) ?? [];
      const weight =
        channels.length === 0 ? DEFAULT_WEIGHT : Math.max(...channels.map((c) => weightOf(c)));
      if (weight <= 0) return null; // every contributing source is disabled for this user
      return { ...a, weight };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((x, y) => y.weight - x.weight || x.page - y.page || x.pageOrder - y.pageOrder);

  const kept = articles.slice(0, cap);
  const dropped = edition._count.articles - kept.length;

  const bySection = new Map<string, typeof kept>();
  for (const a of kept) {
    const arr = bySection.get(a.section) ?? [];
    arr.push(a);
    bySection.set(a.section, arr);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-3">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">My Newspaper</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">
          {lang === "en" ? "Your personal digest" : "Ваш личный дайджест"}
        </h1>
        <p className="font-ui mt-1 text-sm text-ink-soft">
          {lang === "en"
            ? `From “${edition.label ?? edition.kind}” · ${kept.length} of ${edition._count.articles} articles`
            : `Из выпуска «${edition.label ?? edition.kind}» · статей ${kept.length} из ${edition._count.articles}`}
          {dropped > 0 ? ` · ${dropped} ${lang === "en" ? "filtered by your settings" : "скрыто по настройкам"}` : ""}
        </p>
      </header>

      {bySection.size === 0 ? (
        <p className="font-ui text-sm text-ink-soft">
          {lang === "en"
            ? "No articles match your preferences for this edition."
            : "Ни одна статья не подходит под ваши настройки в этом выпуске."}
        </p>
      ) : (
        [...bySection.entries()].map(([section, list]) => (
          <section key={section}>
            <h2 className="font-ui text-xs uppercase tracking-[0.22em] text-ink-faint">
              {sectionLabel(section, lang)}
            </h2>
            <ul className="mt-2 divide-y divide-rule border border-rule bg-paper">
              {list.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <Link
                    href={`/newspaper/${edition.id}`}
                    className="group block"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-base font-bold leading-snug text-ink group-hover:underline decoration-rule-dark underline-offset-2">
                        {a.headline}
                      </h3>
                      <span className="font-ui shrink-0 text-xs text-ink-faint">p.{a.page}</span>
                    </div>
                    {a.summary && (
                      <p className="font-body mt-1 line-clamp-2 text-sm text-ink-soft">{a.summary}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Link
        href={`/newspaper/${edition.id}`}
        className="font-ui inline-block text-sm font-bold uppercase tracking-widest text-accent hover:underline decoration-rule-dark underline-offset-4"
      >
        {lang === "en" ? "Open the full edition →" : "Открыть полный выпуск →"}
      </Link>
    </div>
  );
}