export type Language = "ru" | "en" | "unk";

/** Rough language guess based on script dominance. */
export function guessLanguage(text: string): Language {
  if (!text) return "unk";
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if ((code >= 0x0410 && code <= 0x044f) || code === 0x0401 || code === 0x0451) cyr++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) lat++;
  }
  if (cyr === 0 && lat === 0) return "unk";
  return cyr > lat ? "ru" : "en";
}

export function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04ff]/.test(text);
}

const NUMERIC_ENTITY_RE = /&#(?:x([0-9a-f]+)|([0-9]+));/gi;

/** Decode numeric HTML entities (&#036; → $, &#x27; → '). Invalid codes stay verbatim. */
export function decodeNumericEntities(text: string): string {
  return text.replace(NUMERIC_ENTITY_RE, (_m, hex?: string, dec?: string) => {
    const code = hex ? Number.parseInt(hex, 16) : Number.parseInt(dec ?? "", 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _m;
  });
}

/** Normalize for duplicate detection: lowercase, collapse whitespace, strip URLs/mentions. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[\u200b\u2060\ufeff]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .join(" ");
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Word shingles for near-duplicate fingerprinting. */
export function shingles(text: string, size = 4): Set<string> {
  const words = tokenize(text);
  const out = new Set<string>();
  if (words.length <= size) {
    if (words.length > 0) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i <= words.length - size; i++) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}