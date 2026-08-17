import { selectFormat, sectionForCategory, type ArticleFormat } from "./format";

export interface PlacedStory {
  id: string;
  headline: string;
  summary: string;
  longForm: string;
  importance: number;
  urgency: boolean;
  isFunny: boolean;
  categoryKey: string;
  language: string;
  firstPostAt: Date;
  sourcesCount: number;
  hasMedia: boolean;
}

export interface ArticlePlacement {
  storyId: string;
  page: number;
  pageOrder: number;
  section: string;
  sectionIndex: number;
  format: ArticleFormat;
  featured: boolean;
  teaser: boolean;
}

export interface LayoutPage {
  page: number;
  kind: "cover" | "section" | "light-reading";
  section: string | null;
  articles: ArticlePlacement[];
}

export interface EditionLayout {
  pages: LayoutPage[];
  masthead: { title: string; dateLabel: string };
}

/** Newspaper section order: front page, topical sections, Light Reading last. */
export const SECTION_ORDER = [
  "world",
  "europe",
  "russia",
  "technology",
  "science",
  "business",
  "games",
  "sports",
  "culture",
] as const;

export const LIGHT_READING_SECTION = "light-reading";

export function sectionForStory(story: PlacedStory): string {
  return sectionForCategory(story.categoryKey, story.isFunny);
}

/** Canonical page order: front page first, Light Reading last, unknown sections before it. */
function sectionRank(section: string): number {
  const idx = SECTION_ORDER.indexOf(section as (typeof SECTION_ORDER)[number]);
  if (idx !== -1) return 10 + idx;
  if (section === "front-page") return 0;
  if (section === LIGHT_READING_SECTION) return 999;
  return 900;
}

const MAX_STORIES_PER_PAGE = 3;
const MAX_COVER_TEASERS = 4;

export interface EditionLayoutOptions {
  maxCoverTeasers?: number;
  maxStoriesPerPage?: number;
}

/**
 * Deterministic edition layout (spec §14 / §7). Never produces empty pages.
 *
 *  - Page 1 = cover: masthead + the single most important story + brief teasers.
 *  - Body = pages grouped by section in SECTION_ORDER, up to 3 stories per page.
 *  - Light Reading (funny) stories land on their own trailing page, if any.
 *  - Teaers and body placements are disjoint: a teaser is a brief, not a duplicate.
 */
export function buildEditionLayout(
  stories: PlacedStory[],
  lang: string,
  options: EditionLayoutOptions = {},
): EditionLayout | null {
  const maxCoverTeasers = options.maxCoverTeasers ?? MAX_COVER_TEASERS;
  const maxStoriesPerPage = options.maxStoriesPerPage ?? MAX_STORIES_PER_PAGE;
  const sorted = [...stories].sort(
    (a, b) => b.importance - a.importance || a.firstPostAt.getTime() - b.firstPostAt.getTime(),
  );
  if (sorted.length === 0) return null;

  const main = sorted[0]!;
  const rest = sorted.slice(1);

  // Cover teasers = next most important stories, kept as short briefs only.
  const teasers = rest.slice(0, maxCoverTeasers);
  const bodyPool = rest.slice(teasers.length);

  const pages: LayoutPage[] = [];
  const placements: ArticlePlacement[] = [];

  // Cover
  const coverFormat = selectFormat({
    importance: main.importance,
    urgent: main.urgency,
    isFunny: main.isFunny,
    hasMedia: main.hasMedia,
    textLength: main.summary.length,
  });
  pages.push({
    page: 1,
    kind: "cover",
    section: null,
    articles: [
      {
        storyId: main.id,
        page: 1,
        pageOrder: 0,
        section: "front-page",
        sectionIndex: 0,
        format: coverFormat,
        featured: true,
        teaser: false,
      },
    ],
  });
  teasers.forEach((t, i) => {
    pages[0]!.articles.push({
      storyId: t.id,
      page: 1,
      pageOrder: i + 1,
      section: "front-page",
      sectionIndex: i + 1,
      format: "BRIEF",
      featured: false,
      teaser: true,
    });
  });

  // Body sections in canonical order.
  const bySection = new Map<string, PlacedStory[]>();
  for (const s of bodyPool) {
    const section = sectionForStory(s);
    const arr = bySection.get(section) ?? [];
    arr.push(s);
    bySection.set(section, arr);
  }

  let page = 1;
  let onPage = MAX_STORIES_PER_PAGE; // force the first body story onto a fresh page
  let currentSection: string | null = null;
  const sectionOrder = [...bySection.keys()].sort(
    (a, b) => sectionRank(a) - sectionRank(b),
  );
  for (const section of sectionOrder) {
    const group = bySection.get(section)!;
    let sectionIndex = 0;
    for (const story of group) {
      if (currentSection !== section || onPage >= maxStoriesPerPage) {
        page++;
        onPage = 0;
        currentSection = section;
        pages.push({ page, kind: section === LIGHT_READING_SECTION ? "light-reading" : "section", section, articles: [] });
      }
      const format = selectFormat({
        importance: story.importance,
        urgent: story.urgency,
        isFunny: story.isFunny,
        hasMedia: story.hasMedia,
        textLength: story.summary.length,
      });
      const placement: ArticlePlacement = {
        storyId: story.id,
        page,
        pageOrder: onPage,
        section,
        sectionIndex,
        format,
        featured: false,
        teaser: false,
      };
      placements.push(placement);
      pages[pages.length - 1]!.articles.push(placement);
      onPage++;
      sectionIndex++;
    }
  }

  return { pages, masthead: mastheadFor(lang) };
}

export function mastheadFor(lang: string): { title: string; dateLabel: string } {
  const now = new Date();
  const title = lang === "en" ? "The Daily News" : "Ежедневные новости";
  const dateLabel = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { title, dateLabel };
}

/** Human-readable edition label, e.g. "Morning edition — Tue, Aug 12". */
export function editionLabel(kind: string, date: Date, lang: string): string {
  const kindLabel = kindLabelOf(kind, lang);
  const dateLabel = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return lang === "en" ? `${kindLabel} — ${dateLabel}` : `${kindLabel} — ${dateLabel}`;
}

export function kindLabelOf(kind: string, lang: string): string {
  if (lang === "en") {
    if (kind === "MORNING") return "Morning edition";
    if (kind === "AFTERNOON") return "Afternoon edition";
    if (kind === "EVENING") return "Evening edition";
  }
  if (kind === "MORNING") return "Утренний выпуск";
  if (kind === "AFTERNOON") return "Дневной выпуск";
  if (kind === "EVENING") return "Вечерний выпуск";
  return kind;
}

export function totalPages(layout: EditionLayout): number {
  return layout.pages.length;
}