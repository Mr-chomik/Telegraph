import { decodeNumericEntities, guessLanguage, normalizeText, tokenize } from "../lib/lang";

export type MediaKindType = "PHOTO" | "VIDEO" | "ANIMATION" | "DOCUMENT" | "AUDIO";

export interface NormalizedMedia {
  kind: MediaKindType;
  remoteId: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  caption: string | null;
}

export interface NormalizedPost {
  text: string;
  normalizedText: string;
  language: string | null;
  isForwarded: boolean;
  forwardedFrom: string | null;
  views: number | null;
  reactionsTotal: number | null;
  media: NormalizedMedia[];
  links: string[];
  /** Clean media caption line used as an image caption / alt text. */
  mediaCaption: string | null;
}

export interface RawPostInput {
  text?: string | null;
  isForwarded?: boolean;
  forwardedFrom?: string | null;
  views?: number | null;
  reactions?: { total?: number; counts?: number[] } | null;
  media?: NormalizedMedia[];
  links?: string[];
}

/**
 * Characters that break rendering or carry no information, removed from post
 * text: invisible/zero-width markers, joiners (ZWJ/ZWNJ), variation selectors,
 * combining keycaps, regional indicators (flags render as letters/tofu on many
 * systems), skin-tone modifiers, and tag characters. Plain emoji are KEPT —
 * they render via the system emoji font; only the "unsupported" fragments are
 * stripped. See also `stripUnsupportedSymbols`.
 */
const UNSUPPORTED_SYMBOL_RE = new RegExp(
  "[" +
    "\\u00ad\\u200b\\u200c\\u200d\\u200e\\u200f\\u2060\\ufeff" + // soft hyphen, zero-width, joiners, LRM/RLM, word joiner, BOM
    "\\ufe00-\\ufe0f" + // variation selectors (️)
    "\\u20e3" + // combining enclosing keycap (1️⃣ → 1)
    "\\u{1f1e6}-\\u{1f1ff}" + // regional indicator symbols (flags)
    "\\u{1f3fb}-\\u{1f3ff}" + // skin-tone modifiers
    "\\u{e0020}-\\u{e007f}" + // tag characters
    "]",
  "gu",
);

/** Remove the unsupported symbol fragments described above and tidy whitespace. */
export function stripUnsupportedSymbols(text: string): string {
  return text
    .replace(UNSUPPORTED_SYMBOL_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function extractLinks(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    const url = m[1] ?? "";
    if (url) out.push(url.replace(/[),.!;:]+$/, ""));
  }
  return [...new Set(out)];
}

/**
 * Channel self-promotion signatures (RU + EN). Each pattern is anchored to the
 * start of a trimmed line and only matches clear call-to-action lines, so
 * legitimate news text is never touched.
 */

// All inflected forms of "подписаться": Подписывайся, Подписывайтесь,
// Подпишись, Подпишитесь, Подписаться, Подпишись.
const SUBSCRIBE_VERB = "(?:ывайся|ывайтесь|ишься|ишся|итесь|аться|айтесь?)";

// "МАКС"/"Макс"/"MAX"/"MAКС" — the MAX streaming brand, often mixed-case/
// mixed-alphabet, and occasionally written in Latin as the 3-letter "MAX".
const MAX_BRAND = "(?:[ММm][ААa][ККk][ССc]|MAX)";

// "телеграм"/"Telegram"/"тг"/"TG" — the app is written in Latin by RU
// channels ("Наш Telegram: …"). Case folding (`i`) never crosses scripts, so
// each script variant must be listed explicitly.
const TG_WORD = "(?:телеграм|telegram|тг|tg)";

const CHANNEL_PROMO_LINES: RegExp[] = [
  new RegExp(`^подпис${SUBSCRIBE_VERB}\\s+(?:на\\s+)?(?:наш\\s+)?(?:${TG_WORD}-?)?канал(?![а-яё])`, "iu"),
  new RegExp(`^подпис${SUBSCRIBE_VERB}\\s+(?:на\\s+)?нас(?![а-яё])`, "iu"),
  new RegExp(`^подпис${SUBSCRIBE_VERB}\\s+чтобы\\s+не\\s+пропустить(?![а-яё])`, "iu"),
  new RegExp(`^подпис${SUBSCRIBE_VERB}\\s+на\\s+\\S+\\s+в\\s+«?${MAX_BRAND}»?`, "iu"),
  new RegExp(`^(?:читайте|смотрите|присоединяйтесь)\\s+нас\\s+в\\s+«?${MAX_BRAND}»?`, "iu"),
  new RegExp(`^если\\s+(?:у\\s+вас\\s+)?не\\s+загружается\\s+видео,?\\s+его\\s+можно\\s+посмотреть\\s+в\\s+«?${MAX_BRAND}»?[.!]?$`, "iu"),
  /^не\s+забудь(?:те)?\s+подпис(?:аться|иваться)(?![а-яё])/iu,
  /^присоединяйся\s+к\s+нашему\s+каналу(?![а-яё])/iu,
  /^наш(?:и)?\s+канал(?:ы)?(?![а-яё])\s*:/iu,
  new RegExp(`^наши\\s+(?:каналы|${TG_WORD}-?каналы)(?![а-яё])`, "iu"),
  /^больше\s+(?:новостей|новостных|новости|инфографики|дайджестов|контента|публикаций|материалов|аналитики|историй|сюжетов|обзоров|разборов)(?![а-яё]).*(?:канале|каналы|подписыва)(?![а-яё])/iu,
  new RegExp(`^больше\\s+в\\s+нашем\\s+(?:${TG_WORD}-?)?канале(?![а-яё])`, "iu"),
  /^поддержать\s+(?:канал|проект|нас)(?![а-яё])/iu,
  /^поддержи(?:те)?\s+(?:канал|проект|нас)(?![а-яё])/iu,
  /^реклама\s*(?:и\s+сотрудничество)?\s*:?$/iu,
  new RegExp(`^реклама\\s+(?:в\\s+(?:канале|${TG_WORD}(?:е)?)|на\\s+канале)(?![а-яё])`, "iu"),
  /^по\s+вопросам\s+рекламы$/iu,
  /^по\s+вопросам\s+сотрудничества\s*:/iu,
  /^сотрудничество\s*:/iu,
  /^ваканси(?:я|и)?\s*:/iu,
  /^постав(?:ь|ьте)\s+(?:лайк(?:а|и)?|реакци(?:ю|и|ей|ею)?)/iu,
  /^скача(?:й|йте)\s+(?:наше\s+)?приложение/iu,
  /^читайте\s+также\s+(?:в|на)\s+(?:наш(?:ем|их|ими|ей)?|сво(?:ём|ем|их|и|ей|ими)?)(?![а-яё])/iu,
  /^перепечатка\s+(?:и\s+использование\s+)?материалов/iu,
  /^использование\s+материалов\s+разрешено/iu,
  /^полн(?:ый|ая)\s+(?:текст|выпуск|версия)\s+.*(?:канале|сайте|MAX)/iu,
  new RegExp(`^наш\\s+${TG_WORD}(?:-канал)?\\s*:\\s*@?\\w+`, "iu"),
  new RegExp(`^${TG_WORD}\\s*:\\s*@?\\w+`, "iu"),
  /^subscribe(?: to)?\s+our\s+(?:telegram\s+)?channel\b/iu,
  /^join\s+our\s+(?:telegram\s+)?channel\b/iu,
  /^follow\s+us\b/iu,
  /^more\s+(?:news|updates|content)\b.*\bchannel\b/iu,
  /^don't\s+forget\s+to\s+subscribe/iu,
  /^for\s+advertising\b/iu,
  /^contact\s+us\b/iu,
  /^advertisement\s*$/iu,
  /^sponsored\b/iu,
  /^promoted\b/iu,
];

/**
 * Inline CTA glued to the end of a news line, e.g.
 * "Текст новости. Подписывайтесь на наш канал: @x" → "Текст новости."
 * Leading symbols/emoji are allowed, but NOT punctuation — a sentence's
 * closing period is preserved.
 */
const INLINE_PROMO_SUFFIX: RegExp[] = [
  new RegExp(`\\s*[\\p{S}\\p{M}\\s]*подпис${SUBSCRIBE_VERB}\\s+(?:на\\s+)?(?:наш\\s+)?(?:${TG_WORD}-?)?канал(?![а-яё]).*$`, "iu"),
  new RegExp(`\\s*[\\p{S}\\p{M}\\s]*подпис${SUBSCRIBE_VERB}\\s+на\\s+\\S+(?:\\s*\\|)?\\s*(?:мы\\s+)?в\\s+«?${MAX_BRAND}»?.*$`, "iu"),
  new RegExp(`\\s*[\\p{S}\\p{M}\\s]*(?:читайте|смотрите|присоединяйтесь)\\s+нас\\s+в\\s+«?${MAX_BRAND}»?.*$`, "iu"),
  /\s+(?:subscribe|join|follow)\s+(?:to\s+)?our\s+(?:telegram\s+)?channel\b.*$/iu,
  /\s*▪️?\s*Канал\s+\S+?\s+в\s+«Максе».*$/iu,
  /\s*▪️?\s*Приложение\s+\S+?\s+для\s+(?:iOS\s+и\s+Android|iOS|Android).*$/iu,
  new RegExp(`\\s*[\\p{S}\\p{M}\\s]*если\\s+(?:у\\s+вас\\s+)?не\\s+загружается\\s+видео,?\\s+его\\s+можно\\s+посмотреть\\s+в\\s+«?${MAX_BRAND}»?.*$`, "iu"),
  /\s+(?:поставь|поставьте|ставь(?:те)?)\s+(?:лайк(?:а|и)?|реакци(?:ю|и|ей|ею)?)\s*$/iu,
  /\s+(?:поддержи(?:те)?\s+(?:канал|нас|проект)\s+(?:лайком|реакцией))\s*$/iu,
  /\s+(?:перепечатка|использование)\s+материалов\s*$/iu,
  /\s+подписывайся\s*$/iu,
];

function stripLeadingMarkers(line: string): string {
  return line.replace(/^[\p{P}\p{S}\p{M}\s]+/u, "").trim();
}

function adSignature(line: string): boolean {
  const core = stripLeadingMarkers(line);
  if (!core) return false;
  return CHANNEL_PROMO_LINES.some((re) => re.test(core));
}

function stripInlinePromoSuffix(line: string): string {
  let out = line;
  for (const re of INLINE_PROMO_SUFFIX) {
    out = out.replace(re, "").replace(/[\s,;:—–-]+$/u, "");
  }
  return out.trim();
}

/**
 * Remove channel advertisements / self-promotion ("подписывайтесь на наш канал
 * в MAX", "больше новостей — на нашем канале", "subscribe to our channel"…)
 * from a post's text. Only whole promo lines and trailing CTA fragments are
 * removed — the news body itself is preserved. The original text stays on
 * TelegramPost.raw; this only produces the cleaned derived text.
 */
export function stripChannelAds(text: string): string {
  const cleaned = text
    .split(/\r?\n/)
    .filter((line) => !adSignature(line))
    .map(stripInlinePromoSuffix)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned;
}

/**
 * Normalize a raw Telegram message into stable intermediate fields.
 * The original text is always preserved on TelegramPost.raw — this only derives.
 */
export function normalizePost(input: RawPostInput): NormalizedPost {
  const text = stripUnsupportedSymbols(decodeNumericEntities(stripChannelAds((input.text ?? "").trim())));
  const media = input.media ?? [];
  const firstMediaCaption = media[0]?.caption ?? null;
  const mediaCaption = firstMediaCaption ? stripUnsupportedSymbols(firstMediaCaption) || null : null;

  return {
    text,
    normalizedText: normalizeText(text),
    language: text ? guessLanguage(text) : media.length > 0 ? null : "unk",
    isForwarded: input.isForwarded ?? false,
    forwardedFrom: input.forwardedFrom ?? null,
    views: input.views ?? null,
    reactionsTotal:
      input.reactions?.total ??
      (input.reactions?.counts?.reduce((a, b) => a + b, 0) ?? null),
    media,
    links: extractLinks(text),
    mediaCaption,
  };
}

export interface KeywordFeatures {
  wordCount: number;
  words: string[];
  uniqueWords: number;
}

export function keywordFeatures(text: string): KeywordFeatures {
  const words = tokenize(normalizeText(text));
  const unique = new Set(words);
  return { wordCount: words.length, words, uniqueWords: unique.size };
}

/** Convert an arbitrary request value into a normalized Telegram username or null. */
export function normalizeTelegramUsername(raw: string): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (v.startsWith("https://t.me/")) v = v.slice("https://t.me/".length);
  if (v.startsWith("http://t.me/")) v = v.slice("http://t.me/".length);
  else if (v.startsWith("t.me/")) v = v.slice("t.me/".length);
  if (v.startsWith("@")) v = v.slice(1);
  v = v.trim().replace(/\/+$/, "");
  if (!/^[a-z0-9_]{3,32}$/.test(v)) return null;
  return v;
}