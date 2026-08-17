import { normalizeText } from "../lib/lang";
import { SPAM_AD_MARKERS, looksEmpty, type Lexicon, CATEGORY_KEYWORDS } from "./lexicons";
import type { ClassificationResult, SpamScores } from "./types";

/** Tokenize into lowercase content words (letters/digits only). */
export function contentTokens(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    set.add(m[0]);
  }
  return set;
}

/** Compute fuzzy ad/spam scores for one post. */
export function spamScores(text: string, links: number): SpamScores {
  if (!text.trim()) return { adScore: 0, spamScore: 100 };
  const lower = ` ${normalizeText(text)} `;
  let adHits = 0;
  let spamHits = 0;
  for (const marker of SPAM_AD_MARKERS) {
    if (lower.includes(marker)) {
      if (marker.length <= 8) adHits++;
      else {
        adHits++;
        spamHits++;
      }
    }
  }
  // Promo-heavy posts: many links for little real text is a strong signal.
  const fingerprinted = links >= 2 && text.length < 160;
  let adScore = Math.min(95, adHits * 34 + (fingerprinted ? 30 : 0));
  let spamScore = Math.min(95, spamHits * 30 + (looksEmpty(text) ? 60 : 0));
  // Clear categories unlikely to be spam.
  adScore = Math.max(adScore, 0);
  spamScore = Math.max(spamScore, 0);
  return { adScore: Math.round(adScore), spamScore: Math.round(spamScore) };
}

/** Deterministic topic classification via keyword intersection. */
export function classifyPost(text: string, channelCategoryKey: string | null): ClassificationResult {
  const tokens = contentTokens(text);
  const normalizedText = ` ${normalizeText(text)} `;

  const scores = new Map<string, number>();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (tokens.has(kwLower) || knownPhrase(normalizedText, kwLower)) hits++;
    }
    if (hits > 0) scores.set(category, hits);
  }

  // A strong hint from the channel's own category.
  if (channelCategoryKey && (scores.size === 0 || (scores.get(channelCategoryKey) ?? 0) >= 1)) {
    scores.set(channelCategoryKey, (scores.get(channelCategoryKey) ?? 0) + 1);
  }

  if (scores.size === 0) {
    return { categoryKey: "misc", confidence: 0.3 };
  }

  let best: string | null = null;
  let bestScore = 0;
  for (const [key, value] of scores) {
    if (value > bestScore) {
      best = key;
      bestScore = value;
    }
  }
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  return { categoryKey: best ?? "misc", confidence: Math.min(1, bestScore / Math.max(2, total)) };
}

function knownPhrase(normalizedText: string, kw: string): boolean {
  return kw.includes(" ") && normalizedText.includes(kw);
}

const POSITIVE_WORDS = new Set([
  "успешно", "выиграл", "победа", "рост", "спасение", "договорились", "хорошо",
  "wins", "success", "growth", "profit", "agreement", "breakthrough",
]);
const NEGATIVE_WORDS = new Set([
  "кризис", "авария", "проигрыш", "сбой", "упал", "убыток", "конфликт", "санкции", "катастрофа", "пострадали",
  "crisis", "crash", "loss", "failed", "war", "accident", "sanction",
]);

/** Lightweight lexicon-based sentiment (-1..1). */
export function sentimentOf(text: string): number {
  const tokens = contentTokens(text);
  let score = 0;
  for (const t of tokens) {
    if (POSITIVE_WORDS.has(t)) score++;
    if (NEGATIVE_WORDS.has(t)) score--;
  }
  if (score > 0) return Math.min(1, score / 3);
  if (score < 0) return Math.max(-1, score / 3);
  return 0;
}

export function isFunnyText(text: string, sentiment: number, importance: number, channelCategory: string | null): boolean {
  if (channelCategory === "humor") return true;
  if (importance <= 25 && sentiment <= 0.5 && /[😀😂🤣🙃😹]/u.test(text)) return true;
  const tokens = contentTokens(text);
  for (const kw of ["кот", "мем", "прикол", "смешно", "funny", "meme"]) {
    if (tokens.has(kw)) return true;
  }
  return false;
}

/** Heuristic: are the texts of several sources in tension (uncertain story)? */
export function sourcesDisagree(texts: string[], minJaccard: (a: Set<string>, b: Set<string>) => number): boolean {
  if (texts.length < 2) return false;
  // If each unique pair shares speech but reported differently enough, flag uncertainty.
  const pairs = pairwise(texts);
  let disagree = 0;
  for (const [a, b] of pairs) {
    const j = minJaccard(contentTokens(a), contentTokens(b));
    if (j < 0.35) disagree++;
  }
  return disagree === pairs.length;
}

function pairwise<T>(items: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i]!, items[j]!]);
  }
  return out;
}

export { looksEmpty as isEmptyLike, normalizeTextForSpam };
export type { Lexicon };
function normalizeTextForSpam(text: string): string {
  return normalizeText(text);
}