"use client";

import { motion } from "framer-motion";
import { PhotoPlate } from "./photo-plate";
import { formatKicker, sectionLabel } from "./section-labels";
import { RichText } from "./rich-text";
import type { ViewerArticle } from "./types";

interface ArticleModalProps {
  article: ViewerArticle;
  lang: "ru" | "en";
  onClose: () => void;
}

export function ArticleModal({ article, lang, onClose }: ArticleModalProps) {
  const paragraphs = (article.body ?? article.summary ?? "").split(/\n{2,}/);
  const section = article.section ?? null;
  const kicker = formatKicker(article.format, lang);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.article
        className="relative w-full max-w-2xl border border-rule bg-paper p-6 shadow-[0_24px_60px_-20px_rgba(28,27,23,0.5)] md:p-10"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to page"
          className="font-ui absolute right-3 top-3 border border-rule px-2.5 py-1 text-xs uppercase tracking-widest text-ink-soft transition-colors hover:border-rule-dark hover:text-ink"
        >
          {lang === "en" ? "Back" : "Назад"}
        </button>

        <header className="border-b border-rule pb-4 pr-16">
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-faint">
            {sectionLabel(section, lang)}
            {kicker ? <span className="text-accent"> · {kicker}</span> : null}
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold leading-tight text-ink md:text-3xl">
            {article.headline}
          </h2>
        </header>

        {article.image && (
          <PhotoPlate
            src={article.image.url}
            alt={article.image.caption ?? article.headline}
            caption={article.image.caption}
            className="mt-5"
            imgClassName="max-h-[420px]"
          />
        )}

        {article.isUncertain && (
          <p className="font-ui mt-4 border-l-2 border-accent bg-paper-dim px-3 py-2 text-xs leading-relaxed text-ink-soft">
            {lang === "en"
              ? "Sources disagree about this story — treat details with caution."
              : "Источники расходятся в деталях — отнеситесь к подробностям с осторожностью."}
          </p>
        )}

        <div className="font-body mt-5 space-y-4 text-[0.98rem] leading-[1.75] text-ink">
          {paragraphs.map((p, i) => {
            const trimmed = p.trim();
            if (!trimmed) return null;
            const isLead = i === 0 && article.summary != null;
            const isByline = /(Опубликовано|Published)\s*:/u.test(trimmed);
            if (isByline) {
              return (
                <p
                  key={i}
                  className="font-ui mt-6 border-t border-rule pt-3 text-xs uppercase tracking-[0.16em] text-ink-faint"
                >
                  <RichText text={trimmed} />
                </p>
              );
            }
            return (
              <p key={i} className={isLead ? "font-bold" : undefined}>
                <RichText text={trimmed} />
              </p>
            );
          })}
        </div>

        <footer className="mt-8 border-t border-rule pt-4">
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-faint">
            {lang === "en" ? "Sources" : "Источники"}
          </p>
          <ul className="font-ui mt-2 space-y-1.5">
            {article.sources.map((s) => (
              <li key={s.id} className="text-sm">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-soft underline decoration-rule-dark underline-offset-2 hover:text-accent hover:decoration-accent"
                  >
                    {s.channelName ?? s.channelUsername ?? s.url}
                  </a>
                ) : (
                  <span className="text-ink-soft">{s.channelName ?? s.channelUsername}</span>
                )}
                {s.messageId != null ? (
                  <span className="text-ink-faint"> · msg {s.messageId}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </footer>
      </motion.article>
    </motion.div>
  );
}
