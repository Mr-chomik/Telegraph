import { PhotoPlate } from "./photo-plate";
import { formatKicker, sectionLabel } from "./section-labels";
import type { ViewerArticle } from "./types";

export interface PageSheetProps {
  page: number;
  kind: "cover" | "section" | "light-reading";
  section: string | null;
  articles: ViewerArticle[];
  masthead: { title: string; dateLabel: string } | null;
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}

export function PageSheet({ page, kind, section, articles, masthead, lang, onOpenArticle }: PageSheetProps) {
  const lead = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="flex h-full flex-col border border-rule bg-paper p-4 shadow-[0_1px_0_0_#1c1b17,0_8px_24px_-16px_rgba(28,27,23,0.45)] sm:p-6">
      {kind === "cover" ? (
        <CoverHeader masthead={masthead} lang={lang} />
      ) : (
        <SectionHeader section={section} kind={kind} lang={lang} />
      )}

      <div className="mt-3 flex-1 overflow-hidden">
        {kind === "cover" ? (
          <CoverBody lead={lead} teasers={rest} lang={lang} onOpenArticle={onOpenArticle} />
        ) : (
          <SectionBody lead={lead} rest={rest} lang={lang} onOpenArticle={onOpenArticle} />
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between border-t border-rule pt-2">
        <span className="font-ui text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          {page === 1 ? masthead?.title ?? "Newspaper" : sectionLabel(section, lang)}
        </span>
        <span className="font-ui text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">p.{page}</span>
      </footer>
    </div>
  );
}

function CoverHeader({ masthead, lang }: { masthead: { title: string; dateLabel: string } | null; lang: "ru" | "en" }) {
  return (
    <header className="text-center">
      <h1 className="masthead text-3xl text-ink sm:text-5xl">
        {masthead?.title ?? (lang === "en" ? "The Daily News" : "Ежедневные новости")}
      </h1>
      <hr className="hairline-heavy mt-2" />
      <hr className="hairline mt-[2px]" />
      <p className="masthead-date mt-2">
        {masthead?.dateLabel ?? (lang === "en" ? "The Daily News" : "Ежедневные новости")}
      </p>
    </header>
  );
}

function SectionHeader({
  section,
  kind,
  lang,
}: {
  section: string | null;
  kind: "section" | "light-reading";
  lang: "ru" | "en";
}) {
  const label = kind === "light-reading" ? sectionLabel("light-reading", lang) : sectionLabel(section, lang);
  return (
    <header>
      <p className="section-banner px-1 py-1.5 text-center">{label}</p>
      <p className="masthead-date mt-2 text-center">{kind === "light-reading" ? label : label}</p>
    </header>
  );
}

function CoverBody({
  lead,
  teasers,
  lang,
  onOpenArticle,
}: {
  lead?: ViewerArticle;
  teasers: ViewerArticle[];
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}) {
  if (!lead) return <p className="font-ui text-sm text-ink-faint">—</p>;
  return (
    <div className="flex h-full flex-col gap-4">
      <ArticleLead article={lead} lang={lang} onOpenArticle={onOpenArticle} />
      {teasers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-t border-rule pt-3">
          {teasers.map((t) => (
            <Teaser key={t.id} article={t} lang={lang} onOpenArticle={onOpenArticle} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBody({
  lead,
  rest,
  lang,
  onOpenArticle,
}: {
  lead?: ViewerArticle;
  rest: ViewerArticle[];
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      {lead && <ArticleLead article={lead} lang={lang} onOpenArticle={onOpenArticle} />}
      {rest.length > 0 && (
        <div className="grid flex-1 grid-cols-1 gap-3 border-t border-rule pt-3 sm:grid-cols-2">
          {rest.map((a) => (
            <ArticleCard key={a.id} article={a} lang={lang} onOpenArticle={onOpenArticle} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleLead({
  article,
  lang,
  onOpenArticle,
}: {
  article: ViewerArticle;
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}) {
  const kicker = formatKicker(article.format, lang);
  return (
    <button type="button" onClick={() => onOpenArticle(article)} className="group text-left">
      {kicker && (
        <p className={`font-ui text-xs font-bold uppercase tracking-[0.2em] ${article.format === "URGENT" ? "text-accent" : "text-ink-faint"}`}>
          {kicker}
        </p>
      )}
      {article.image && (
        <PhotoPlate
          src={article.image.url}
          alt={article.image.caption ?? article.headline}
          caption={article.image.caption}
          className="mt-2"
          imgClassName="aspect-[3/2]"
        />
      )}
      <h3 className="font-display mt-2 text-2xl font-bold leading-[1.06] text-ink group-hover:underline decoration-rule-dark underline-offset-4 sm:text-4xl">
        {article.headline}
      </h3>
      {article.summary && (
        <p className="font-body mt-2 text-[0.95rem] leading-[1.6] text-ink-soft sm:text-base">{article.summary}</p>
      )}
    </button>
  );
}

function Teaser({
  article,
  lang,
  onOpenArticle,
}: {
  article: ViewerArticle;
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}) {
  void lang;
  return (
    <button
      type="button"
      onClick={() => onOpenArticle(article)}
      className="group border-t border-rule pt-2 text-left"
    >
      <h4 className="font-display text-base font-bold leading-snug text-ink group-hover:underline decoration-rule-dark underline-offset-2">
        {article.headline}
      </h4>
      {article.summary && (
        <p className="font-body mt-1 line-clamp-3 text-xs leading-[1.5] text-ink-soft">{article.summary}</p>
      )}
    </button>
  );
}

function ArticleCard({
  article,
  lang,
  onOpenArticle,
}: {
  article: ViewerArticle;
  lang: "ru" | "en";
  onOpenArticle: (article: ViewerArticle) => void;
}) {
  const kicker = formatKicker(article.format, lang);
  return (
    <button type="button" onClick={() => onOpenArticle(article)} className="group text-left">
      {kicker && (
        <p className={`font-ui text-[0.65rem] font-bold uppercase tracking-[0.2em] ${article.format === "URGENT" ? "text-accent" : "text-ink-faint"}`}>
          {kicker}
        </p>
      )}
      <h4 className="font-display mt-0.5 text-xl font-bold leading-snug text-ink group-hover:underline decoration-rule-dark underline-offset-2">
        {article.headline}
      </h4>
      {article.summary && (
        <p className="font-body mt-1 line-clamp-4 text-[0.85rem] leading-[1.55] text-ink-soft">
          {article.summary}
        </p>
      )}
    </button>
  );
}
