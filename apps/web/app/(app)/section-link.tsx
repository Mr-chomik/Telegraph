import type { Edition } from "@telegraph/db";

export function SectionLink({
  edition,
}: {
  edition: Edition & { articles: Array<{ id: string; headline: string; section: string; format: string }> };
}) {
  const label =
    edition.label ?? `${edition.kind.toLowerCase()} edition · ${edition.editionDate.toLocaleDateString()}`;
  return (
    <a
      href={`/newspaper/${edition.id}`}
      className="group block border border-rule bg-paper p-5 transition-all hover:border-rule-dark hover:shadow-[0_1px_0_0_#1c1b17,0_4px_14px_-6px_rgba(28,27,23,0.35)]"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-ui text-xs uppercase tracking-widest text-accent">Latest edition</p>
          <h2 className="font-display mt-1 text-2xl font-bold text-ink">
            {edition.editionDate.toLocaleDateString()} · {label}
          </h2>
          <p className="font-ui mt-1 text-sm text-ink-soft">
            {edition.pageCount} pages · {edition.articles.length} articles
          </p>
        </div>
        <span className="font-ui text-xs font-bold uppercase tracking-widest text-ink-soft group-hover:text-ink">
          Read →
        </span>
      </div>
    </a>
  );
}