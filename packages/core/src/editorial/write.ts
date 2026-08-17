import { truncate } from "../lib/lang";

export interface EditorialWriteOptions {
  language: string | null;
  urgent: boolean;
  sourcesCount: number;
  uncertain: boolean;
}

export interface ArticleFooterOptions {
  language: string | null;
  sourcesCount: number;
  channelTitle: string | null;
  publishedAt: Date | null;
}

export interface WrittenFields {
  headline: string;
  summary: string;
  longForm: string;
}

const SENTENCE_SPLIT = /(?<=[.!?…])\s+|\n+/g;

function sentencesOf(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Any emoji / pictograph / stray symbol, wherever it appears. Headlines and
 * summaries are clean text — emoji never survive into them. Covers
 * Extended_Pictographic (the broad emoji set), symbols, arrows, dingbats,
 * geometric shapes, flags, skin tones and keycaps; also strips variation
 * selectors and joiners so broken emoji fragments can't leak through.
 */
const EMOJI_SYMBOL_RE =
  /[\p{Extended_Pictographic}\p{So}\p{Sk}\u2190-\u21ff\u25a0-\u25ff\u2600-\u27bf\u2b00-\u2bff\u{1f1e6}-\u{1f1ff}\u{1f3fb}-\u{1f3ff}\u20e3\ufe0f\u200d\u200c]/gu;

/**
 * Strip lead markers and symbol noise from a text before it becomes a
 * headline/summary: URLs, mentions, emoji, leading bullets/dashes, leading
 * time tokens ("08:30 …"), then "Срочно:", "BREAKING" and similar.
 */
function cleanLead(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/@[\w.-]+\b/g, " ")
    .replace(EMOJI_SYMBOL_RE, " ")
    .replace(/^[\s\p{Pd}\u2022\u2023\u25cf\u25aa\u25ab\u2043\u2219…]+/u, "")
    .replace(/^\d{1,2}:\d{2}\s*/u, "")
    .replace(/^(срочно|экстренно|breaking|just in|сводка дня|главное|важно)[\s:!.]*:?\s*/iu, "")
    .replace(/\s+([,.;:!?…]+)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Крупное отключение произошло в городе" → "Крупное отключение в городе". */
const WEAK_VERB = /\s+(?:произош(?:ёл|ла|ло|ли)|прош(?:ёл|ла|ло|ли)|состоял(?:ся|ась|ось)|начал(?:ся|ась|ось|ись)?|стартовал(?:а|о|и)?|запущен(?:а|о|ы)?|открыл(?:ся|ась|ось|ись)?)\s+/iu;

function dropWeakVerb(sentence: string): string {
  const dropped = sentence.replace(WEAK_VERB, " ");
  const words = dropped.split(/\s+/).filter(Boolean).length;
  return words >= 3 ? dropped : sentence;
}

/** Pick the clause of a sentence that carries the headline payload. */
function mainClauseOf(sentence: string): string {
  const parts = sentence.split(/\s+[—–,:;]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return sentence;
  let best = parts[0]!;
  let bestScore = -1;
  for (const part of parts) {
    const words = part.split(/\s+/).length;
    const keyword = /(закон|запуск|выбор|авария|катастроф|соглашен|побед|отставк|рекорд|проект|санкци|налог|забастовк|переговор|войн|пожар|отключ|угроз|удар|взрыв|кризис)/iu.test(part) ? 2 : 0;
    const score = keyword + Math.min(words / 12, 1) + (part === parts[0] ? 0.3 : 0);
    if (score > bestScore) {
      best = part;
      bestScore = score;
    }
  }
  return best;
}

const HEADLINE_KEYWORDS =
  /(президент|закон|выбор|запуск|катастроф|успешно|рекорд|авария|пожар|удар|взрыв|отключ|проект|соглашен|побед|кризис|санкци|налог|переговор|войн|отставк)/iu;

function scoreCandidate(sentence: string, index: number, urgent: boolean): number {
  const words = sentence.split(/\s+/);
  const len = words.length;
  if (len < 5 || len > 24) return -Infinity;
  let score = 0;
  score += (sentence.match(new RegExp(HEADLINE_KEYWORDS.source, "gi")) ?? []).length * 2;
  score += index === 0 ? 1.2 : 0; // lead sentence tie-break only
  score += /\d/.test(sentence) ? 1 : 0;
  if (urgent && /(срочно|экстренно|breaking|just in)/i.test(sentence)) score += 2;
  return score + Math.min(1, len / 30);
}

function pickSentence(sentences: string[], urgent: boolean): string {
  let best = sentences[0] ?? "";
  let bestScore = -Infinity;
  sentences.forEach((s, i) => {
    const score = scoreCandidate(s, i, urgent);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  });
  return best;
}

function capitalizeHeadline(headline: string): string {
  const t = headline.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * A headline is a short phrase — never a verbatim copy of the article body.
 * Lead markers are stripped, the main clause is kept, and weak verbs
 * ("произошло", "прошёл", "стартовал"…) that carry no information are dropped
 * ("Крупное отключение произошло в Алма-Ате" → "Крупное отключение в Алма-Ате").
 */
function buildHeadline(text: string, urgent: boolean): string {
  const cleaned = cleanLead(text);
  if (!cleaned) return "";
  const sentences = sentencesOf(cleaned);
  const chosen = sentences.length <= 1 ? (sentences[0] ?? cleaned) : pickSentence(sentences, urgent);
  let head = mainClauseOf(chosen);
  head = dropWeakVerb(head);
  head = head
    .replace(/[\s—–,:;.!?…]+$/u, "")
    .replace(/[!?]{2,}/g, (m) => m.charAt(0))
    .replace(/\s{2,}/g, " ")
    .trim();
  if (head.length < 8 && sentences.length > 1) head = chosen;
  return capitalizeHeadline(truncate(head, 80));
}

function buildSummary(primaryText: string, opts: EditorialWriteOptions): string {
  const cleaned = cleanLead(primaryText);
  const sentences = sentencesOf(cleaned);
  let summary = truncate(sentences.slice(0, 2).join(" "), 240);
  if (opts.uncertain) {
    summary += opts.language === "en"
      ? " Reports differ on key details."
      : " Источники расходятся в деталях.";
  }
  return summary;
}

/**
 * The body is the story itself: the lead (deck) followed by the full original
 * publication. The footer (sources + publish time) is appended separately by
 * the caller so it survives AI refinement.
 */
function buildLongForm(primaryText: string, summary: string): string {
  const body = primaryText.replace(/\s+/g, " ").trim();
  const compact = body === summary.replace(/\s+/g, " ").trim();
  return compact ? summary : `${summary}\n\n${body}`;
}

/** Deterministic headline / summary / lead paragraph (NoAI mode). */
export function writeEditorial(
  primaryText: string,
  opts: EditorialWriteOptions,
): WrittenFields {
  const headline = buildHeadline(primaryText, opts.urgent);
  const summary = buildSummary(primaryText, opts);
  const longForm = buildLongForm(primaryText, summary);
  return { headline, summary, longForm };
}

/** "14 августа 2026, 12:53" / "August 14, 2026, 12:53". */
export function formatPostTime(date: Date, language: string | null): string {
  const locale = language === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Closing lines of an article: multi-source note, the primary source, and the
 * news-post publish time — the post time is always the last line.
 */
export function articleFooter(opts: ArticleFooterOptions): string {
  const lines: string[] = [];
  if (opts.sourcesCount > 1) {
    lines.push(
      opts.language === "en"
        ? `This story is based on ${opts.sourcesCount} sources.`
        : `В материале использованы публикации ${opts.sourcesCount} источников.`,
    );
  }
  const source = opts.channelTitle?.trim();
  if (source) {
    lines.push(opts.language === "en" ? `Source: ${source}.` : `Источник: «${source}».`);
  }
  if (opts.publishedAt) {
    lines.push(
      `${opts.language === "en" ? "Published" : "Опубликовано"}: ${formatPostTime(opts.publishedAt, opts.language)}`,
    );
  }
  return lines.join("\n");
}

/** AI-enriched fields, but only truth that already appears in sources. */
export function mergeAiDraft(
  deterministic: WrittenFields,
  ai: Partial<Pick<WrittenFields, "headline" | "summary" | "longForm">> | null,
): WrittenFields {
  if (!ai) return deterministic;
  return {
    headline:
      typeof ai.headline === "string" && ai.headline.trim().length >= 8 && ai.headline.length <= 160
        ? ai.headline.trim()
        : deterministic.headline,
    summary:
      typeof ai.summary === "string" && ai.summary.trim().length >= 20 && ai.summary.length <= 800
        ? ai.summary.trim()
        : deterministic.summary,
    longForm:
      typeof ai.longForm === "string" && ai.longForm.trim().length >= 40 && ai.longForm.length <= 4000
        ? ai.longForm.trim()
        : deterministic.longForm,
  };
}