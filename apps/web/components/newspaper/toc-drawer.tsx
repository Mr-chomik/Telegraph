"use client";

import { motion, AnimatePresence } from "framer-motion";
import { sectionLabel } from "./section-labels";
import type { ViewerPage } from "./types";

interface TocDrawerProps {
  open: boolean;
  pages: ViewerPage[];
  lang: "ru" | "en";
  onClose: () => void;
  onJump: (page: number) => void;
}

export function TocDrawer({ open, pages, lang, onClose, onJump }: TocDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[min(20rem,90vw)] flex-col border-l border-rule bg-paper shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            aria-label={lang === "en" ? "Table of contents" : "Оглавление"}
          >
            <header className="flex items-center justify-between border-b border-rule px-4 py-3">
              <h2 className="font-display text-lg font-bold text-ink">
                {lang === "en" ? "Contents" : "Оглавление"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close contents"
                className="font-ui border border-rule px-2.5 py-1 text-xs uppercase tracking-widest text-ink-soft hover:border-rule-dark hover:text-ink"
              >
                ✕
              </button>
            </header>

            <nav className="flex-1 overflow-y-auto px-4 py-3">
              <ul className="space-y-1">
                {pages.map((p) => (
                  <li key={p.page}>
                    <button
                      type="button"
                      onClick={() => onJump(p.page)}
                      className="group flex w-full items-baseline justify-between gap-3 border-b border-rule/60 px-1 py-2 text-left transition-colors hover:bg-paper-dim"
                    >
                      <span className="font-ui min-w-0 text-sm text-ink">
                        <span className="font-display text-xs text-ink-faint">p.{p.page} </span>
                        {p.kind === "cover"
                          ? lang === "en"
                            ? "Front page"
                            : "Первая полоса"
                          : sectionLabel(p.section, lang)}
                      </span>
                      <span className="font-ui shrink-0 text-xs text-ink-faint">
                        {p.articles.length}
                      </span>
                    </button>
                    <p className="font-body mb-2 line-clamp-1 px-1 text-xs text-ink-soft">
                      {p.articles[0]?.headline}
                    </p>
                  </li>
                ))}
              </ul>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
