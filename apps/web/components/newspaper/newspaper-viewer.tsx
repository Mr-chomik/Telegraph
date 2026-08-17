"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArticleModal } from "./article-modal";
import { PageSheet } from "./page-sheet";
import { TocDrawer } from "./toc-drawer";
import type { ViewerArticle, ViewerEdition, ViewerPage } from "./types";

interface NewspaperViewerProps {
  edition: ViewerEdition;
  articles: ViewerArticle[];
  lang: "ru" | "en";
}

type Direction = "forward" | "backward";

const PAGE_ASPECT = 3 / 4;

/**
 * A page turn is rendered as an overlay on top of the destination spread:
 * one sheet (the old page) rotates around the spine, showing the NEW page on
 * its back, and lands exactly over the identical backdrop page — so removing
 * the overlay is seamless. See the flip* overlays below.
 */
interface FlipState {
  kind: "sheet" | "fold" | "fade";
  direction: Direction;
  frontPage: ViewerPage;
  backPage: ViewerPage;
  staticPage: ViewerPage | null;
  oldPages: ViewerPage[];
}

export function NewspaperViewer({ edition, articles, lang }: NewspaperViewerProps) {
  const isDesktop = useIsDesktop();
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const flipTimer = useRef<number | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const pages = useMemo(() => buildPages(articles), [articles]);
  const totalPages = pages.length;

  const [currentPage, setCurrentPage] = useState(1);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [openArticle, setOpenArticle] = useState<ViewerArticle | null>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);

  const step = isDesktop ? 2 : 1;

  const clearFlipSoon = useCallback(() => {
    if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    flipTimer.current = window.setTimeout(() => setFlip(null), 1150);
  }, []);

  useEffect(() => {
    return () => {
      if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    };
  }, []);

  const goTo = useCallback(
    (target: number, dir: Direction) => {
      if (reduceMotion) {
        setCurrentPage(target);
        return;
      }
      const oldVisible = isDesktop
        ? pages.slice(currentPage - 1, currentPage + 1)
        : pages.slice(currentPage - 1, currentPage);
      const newVisible = isDesktop
        ? pages.slice(target - 1, target + 1)
        : pages.slice(target - 1, target);
      setFlip(buildFlip(oldVisible, newVisible, dir, isDesktop));
      clearFlipSoon();
      setCurrentPage(target);
    },
    [pages, isDesktop, currentPage, reduceMotion, clearFlipSoon],
  );

  const next = useCallback(() => {
    goTo(Math.min(totalPages, currentPage + step), "forward");
  }, [goTo, totalPages, currentPage, step]);

  const prev = useCallback(() => {
    goTo(Math.max(1, currentPage - step), "backward");
  }, [goTo, currentPage, step]);

  const jumpTo = useCallback(
    (page: number) => {
      goTo(page, page >= currentPage ? "forward" : "backward");
    },
    [goTo, currentPage],
  );

  // Track the stage size so the paper always fills the available space —
  // the page size is derived from it (no fixed rem caps → less empty space).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenArticle((a) => {
          if (a) return null;
          setTocOpen(false);
          return a;
        });
        return;
      }
      if (openArticle || tocOpen) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, openArticle, tocOpen]);

  // Swipe gesture.
  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  };

  // Desktop shows a two-page spread starting at currentPage; mobile shows one page.
  const visible = isDesktop
    ? pages.slice(currentPage - 1, currentPage + 1)
    : pages.slice(currentPage - 1, currentPage);
  const isLastSpread = currentPage === totalPages || (isDesktop && currentPage === totalPages - 1);

  // Size pages to fill the stage: fit width (minus gutters) and height (aspect).
  const count = visible.length;
  const spreadGap = isDesktop ? 24 : 16;
  const pageWidth =
    stage.w > 0 && stage.h > 0
      ? Math.max(120, Math.min((stage.w - spreadGap * (count - 1)) / count, stage.h * PAGE_ASPECT))
      : undefined;

  return (
    <div className="flex flex-col">
      <header className="mb-4 border-b border-rule pb-3 text-center">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">
          {edition.label ?? `${edition.kind} edition`}
        </p>
        <p className="font-ui mt-1 text-xs uppercase tracking-[0.18em] text-ink-faint">
          {formatDate(edition.editionDate, lang)}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 font-ui text-xs text-ink-soft">
        <button
          type="button"
          onClick={prev}
          disabled={currentPage === 1}
          className="border border-rule px-3 py-1.5 uppercase tracking-widest transition-colors hover:border-rule-dark hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          {lang === "en" ? "← Prev" : "← Назад"}
        </button>
        <span className="order-last w-full text-center uppercase tracking-widest sm:order-none sm:w-auto">
          {lang === "en" ? "Page" : "Стр."} {currentPage}
          {isDesktop ? `–${Math.min(totalPages, currentPage + 1)}` : ""} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setTocOpen(true)}
          className="border border-rule px-3 py-1.5 uppercase tracking-widest transition-colors hover:border-rule-dark hover:text-ink"
          aria-label="Table of contents"
        >
          {lang === "en" ? "Contents" : "Оглавление"}
        </button>
        <button
          type="button"
          onClick={next}
          disabled={isLastSpread}
          className="border border-rule px-3 py-1.5 uppercase tracking-widest transition-colors hover:border-rule-dark hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          {lang === "en" ? "Next →" : "Далее →"}
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative mt-4 flex h-[min(calc(100svh-14rem),52rem)] min-h-[16rem] items-center justify-center"
        style={{ perspective: "2200px", touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="flex items-stretch justify-center gap-4 sm:gap-6">
          {visible.map((p, i) => (
            <div key={p.page} className="relative max-w-full">
              <div
                className="aspect-[3/4]"
                style={{ width: pageWidth ?? "100%", maxWidth: "100%" }}
              >
                <div className="h-full w-full overflow-hidden">
                  <PageSheet
                    page={p.page}
                    kind={p.kind}
                    section={p.section}
                    articles={p.articles}
                    masthead={edition.masthead}
                    lang={lang}
                    onOpenArticle={setOpenArticle}
                  />
                </div>
              </div>
              {/* Book-gutter shading on the spine edge of each page. */}
              {count > 1 && (
                <div
                  className={`pointer-events-none absolute inset-y-0 w-6 ${
                    i === 0
                      ? "right-0 bg-gradient-to-l from-ink/15 to-transparent"
                      : "left-0 bg-gradient-to-r from-ink/15 to-transparent"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {flip && (
          <FlipOverlay
            flip={flip}
            pageWidth={pageWidth ?? 0}
            gap={spreadGap}
            lang={lang}
            onOpenArticle={setOpenArticle}
            onDone={() => setFlip(null)}
          />
        )}
      </div>

      <AnimatePresence>
        {openArticle && (
          <ArticleModal article={openArticle} lang={lang} onClose={() => setOpenArticle(null)} />
        )}
      </AnimatePresence>

      <TocDrawer
        open={tocOpen}
        pages={pages}
        lang={lang}
        onClose={() => setTocOpen(false)}
        onJump={(page) => {
          jumpTo(page);
          setTocOpen(false);
        }}
      />
    </div>
  );
}

/** Decide how the turn is rendered for a given old/new spread pair. */
function buildFlip(
  oldVisible: ViewerPage[],
  newVisible: ViewerPage[],
  dir: Direction,
  isDesktop: boolean,
): FlipState {
  if (!isDesktop || oldVisible.length === 1 || newVisible.length === 1) {
    // Single-page destinations (mobile, and the last page of an odd-length
    // paper): the page folds away like a sheet lifted off the paper.
    return {
      kind: "fold",
      direction: dir,
      frontPage: oldVisible[0] ?? newVisible[0]!,
      backPage: newVisible[0]!,
      staticPage: null,
      oldPages: oldVisible,
    };
  }
  if (dir === "forward") {
    return {
      kind: "sheet",
      direction: dir,
      frontPage: oldVisible[1]!,
      backPage: newVisible[0]!,
      staticPage: oldVisible[0]!,
      oldPages: oldVisible,
    };
  }
  return {
    kind: "sheet",
    direction: dir,
    frontPage: oldVisible[0]!,
    backPage: newVisible[1]!,
    staticPage: oldVisible[1]!,
    oldPages: oldVisible,
  };
}

function FlipOverlay({
  flip,
  pageWidth,
  gap,
  lang,
  onOpenArticle,
  onDone,
}: {
  flip: FlipState;
  pageWidth: number;
  gap: number;
  lang: "ru" | "en";
  onOpenArticle: (a: ViewerArticle) => void;
  onDone: () => void;
}) {
  if (flip.kind === "sheet") {
    return (
      <SheetFlip
        flip={flip}
        pageWidth={pageWidth}
        gap={gap}
        lang={lang}
        onOpenArticle={onOpenArticle}
        onDone={onDone}
      />
    );
  }
  if (flip.kind === "fold") {
    return (
      <FoldFlip
        flip={flip}
        pageWidth={pageWidth}
        lang={lang}
        onOpenArticle={onOpenArticle}
        onDone={onDone}
      />
    );
  }
  return (
    <FadeFlip
      flip={flip}
      pageWidth={pageWidth}
      gap={gap}
      lang={lang}
      onOpenArticle={onOpenArticle}
      onDone={onDone}
    />
  );
}

function PageSlot({
  page,
  width,
  lang,
  onOpenArticle,
  className,
}: {
  page: ViewerPage;
  width: number;
  lang: "ru" | "en";
  onOpenArticle: (a: ViewerArticle) => void;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[3/4] ${className ?? ""}`} style={{ width }}>
      <div className="h-full w-full overflow-hidden">
        <PageSheet
          page={page.page}
          kind={page.kind}
          section={page.section}
          articles={page.articles}
          masthead={null}
          lang={lang}
          onOpenArticle={onOpenArticle}
        />
      </div>
    </div>
  );
}

/**
 * A real page turn: the old right (or left) page rotates around the spine
 * about 180°, its BACK face is the incoming page, and it lands exactly over
 * the identical backdrop page — the overlay is then removed seamlessly.
 */
function SheetFlip({
  flip,
  pageWidth,
  gap,
  lang,
  onOpenArticle,
  onDone,
}: {
  flip: FlipState;
  pageWidth: number;
  gap: number;
  lang: "ru" | "en";
  onOpenArticle: (a: ViewerArticle) => void;
  onDone: () => void;
}) {
  const forward = flip.direction === "forward";
  const turn = forward ? -180 : 180;
  const origin = forward ? "left center" : "right center";
  const shadowBg = forward
    ? "linear-gradient(90deg, rgba(28,27,23,0.30), rgba(28,27,23,0.05) 60%, transparent 78%)"
    : "linear-gradient(270deg, rgba(28,27,23,0.30), rgba(28,27,23,0.05) 60%, transparent 78%)";
  const turnEase = [0.3, 0.08, 0.24, 1] as const;

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex" style={{ gap }}>
        {forward && flip.staticPage && (
          <PageSlot page={flip.staticPage} width={pageWidth} lang={lang} onOpenArticle={onOpenArticle} />
        )}
        <motion.div
          className="relative aspect-[3/4]"
          style={{ width: pageWidth, transformStyle: "preserve-3d", transformOrigin: origin }}
          initial={{ rotateY: 0, z: 0, scale: 1 }}
          animate={{ rotateY: [0, turn * 0.5, turn], z: [0, 70, 0], scale: [1, 1.045, 1] }}
          transition={{ duration: 0.9, ease: turnEase, times: [0, 0.5, 1] }}
          onAnimationComplete={onDone}
        >
          <motion.div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
            initial={{ filter: "brightness(1)" }}
            animate={{ filter: "brightness(0.9)" }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >
            <div className="h-full w-full overflow-hidden">
              <PageSheet
                page={flip.frontPage.page}
                kind={flip.frontPage.kind}
                section={flip.frontPage.section}
                articles={flip.frontPage.articles}
                masthead={null}
                lang={lang}
                onOpenArticle={onOpenArticle}
              />
            </div>
          </motion.div>
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="h-full w-full overflow-hidden">
              <PageSheet
                page={flip.backPage.page}
                kind={flip.backPage.kind}
                section={flip.backPage.section}
                articles={flip.backPage.articles}
                masthead={null}
                lang={lang}
                onOpenArticle={onOpenArticle}
              />
            </div>
          </div>
          {/* Crease shadow that sweeps across the sheet as it turns. */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ background: shadowBg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.15, 0] }}
            transition={{ duration: 0.9, ease: "easeInOut", times: [0, 0.4, 0.75, 1] }}
          />
        </motion.div>
        {!forward && flip.staticPage && (
          <PageSlot page={flip.staticPage} width={pageWidth} lang={lang} onOpenArticle={onOpenArticle} />
        )}
      </div>
    </motion.div>
  );
}

/** Single-page fold: the old page lifts and folds away, revealing the next page. */
function FoldFlip({
  flip,
  pageWidth,
  lang,
  onOpenArticle,
  onDone,
}: {
  flip: FlipState;
  pageWidth: number;
  lang: "ru" | "en";
  onOpenArticle: (a: ViewerArticle) => void;
  onDone: () => void;
}) {
  const forward = flip.direction === "forward";
  const turn = forward ? -180 : 180;
  const origin = forward ? "left center" : "right center";
  const shadowBg = forward
    ? "linear-gradient(90deg, rgba(28,27,23,0.30), transparent 70%)"
    : "linear-gradient(270deg, rgba(28,27,23,0.30), transparent 70%)";

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <motion.div
        className="relative aspect-[3/4]"
        style={{ width: pageWidth, transformStyle: "preserve-3d", transformOrigin: origin }}
        initial={{ rotateY: 0, z: 0, scale: 1, opacity: 1 }}
        animate={{ rotateY: [0, turn * 0.5, turn], z: [0, 90, 0], scale: [1, 1.05, 1], opacity: [1, 1, 1, 0] }}
        transition={{ duration: 0.85, ease: [0.35, 0.1, 0.25, 1], times: [0, 0.45, 0.8, 1] }}
        onAnimationComplete={onDone}
      >
        <div className="absolute inset-0">
          <div className="h-full w-full overflow-hidden">
            <PageSheet
              page={flip.frontPage.page}
              kind={flip.frontPage.kind}
              section={flip.frontPage.section}
              articles={flip.frontPage.articles}
              masthead={null}
              lang={lang}
              onOpenArticle={onOpenArticle}
            />
          </div>
        </div>
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: shadowBg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.1, 0] }}
          transition={{ duration: 0.85, ease: "easeInOut", times: [0, 0.4, 0.7, 1] }}
        />
      </motion.div>
    </motion.div>
  );
}

/** Quick crossfade for the odd-page boundary of an odd-length paper. */
function FadeFlip({
  flip,
  pageWidth,
  gap,
  lang,
  onOpenArticle,
  onDone,
}: {
  flip: FlipState;
  pageWidth: number;
  gap: number;
  lang: "ru" | "en";
  onOpenArticle: (a: ViewerArticle) => void;
  onDone: () => void;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeIn" }}
      onAnimationComplete={onDone}
    >
      <div className="flex" style={{ gap }}>
        {flip.oldPages.map((p) => (
          <PageSlot key={p.page} page={p} width={pageWidth} lang={lang} onOpenArticle={onOpenArticle} />
        ))}
      </div>
    </motion.div>
  );
}

function buildPages(articles: ViewerArticle[]): ViewerPage[] {
  const byPage = new Map<number, ViewerArticle[]>();
  for (const a of articles) {
    const arr = byPage.get(a.page) ?? [];
    arr.push(a);
    byPage.set(a.page, arr);
  }
  const numbers = [...byPage.keys()].sort((x, y) => x - y);
  return numbers.map((n) => {
    const arts = [...byPage.get(n)!].sort((x, y) => x.pageOrder - y.pageOrder);
    const kind: ViewerPage["kind"] =
      n === 1
        ? "cover"
        : arts.some((a) => a.layoutKind === "light-reading" || a.section === "light-reading")
          ? "light-reading"
          : "section";
    return { page: n, kind, section: arts[0]?.section ?? null, articles: arts };
  });
}

function formatDate(iso: string, lang: "ru" | "en"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
