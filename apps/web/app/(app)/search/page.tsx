import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { searchArticles } from "@/lib/search";
import { sectionLabel } from "@/components/newspaper/section-labels";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  const lang: "ru" | "en" = session.language === "en" ? "en" : "ru";
  const query = (q ?? "").trim().slice(0, 200);
  const results = query ? await searchArticles(query) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-3">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">Search</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">
          {lang === "en" ? "Find in the newspaper" : "Поиск по газете"}
        </h1>
      </header>

      <form action="/search" method="get" role="search">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={
              lang === "en"
                ? "Headlines, sections, sources…"
                : "Заголовки, разделы, источники…"
            }
            className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
          />
          <button
            type="submit"
            className="font-ui bg-ink px-5 py-2 text-sm font-bold uppercase tracking-widest text-paper hover:bg-ink-soft"
          >
            {lang === "en" ? "Search" : "Найти"}
          </button>
        </div>
      </form>

      {query && (
        <div>
          <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">
            {results.length === 0
              ? lang === "en"
                ? "No matches"
                : "Ничего не найдено"
              : `${results.length} ${lang === "en" ? "results" : "результатов"}`
              }
          </p>

          {results.length > 0 && (
            <ul className="mt-3 divide-y divide-rule border border-rule bg-paper">
              {results.map((r) => (
                <li key={r.articleId}>
                  <Link
                    href={`/newspaper/${r.editionId}`}
                    className="group flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-paper-dim"
                  >
                    <div className="min-w-0">
                      <p className="font-ui text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
                        {sectionLabel(r.section, lang)}
                        {r.featured ? " · " + (lang === "en" ? "front page" : "первая полоса") : ""}
                      </p>
                      <h3 className="font-display mt-0.5 text-lg font-bold leading-snug text-ink group-hover:underline decoration-rule-dark underline-offset-2">
                        {r.headline}
                      </h3>
                      {r.summary && (
                        <p className="font-body mt-1 line-clamp-2 text-sm text-ink-soft">{r.summary}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-ui text-xs text-ink-faint">
                        p.{r.page}
                      </p>
                      <p className="font-ui text-xs text-ink-faint">
                        {formatDate(r.editionDate, lang)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date, lang: "ru" | "en"): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", {
    day: "numeric",
    month: "short",
  }).format(d);
}