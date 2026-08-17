import { decodeNumericEntities } from "../lib/lang";

export interface ChannelPreview {
  username: string;
  title: string;
  description: string;
  avatarUrl: string | null;
  postCount: number | null;
  exists: boolean;
}

const PREVIEW_URL = (username: string): string => `https://t.me/s/${encodeURIComponent(username)}`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(name: string, html: string): string | null {
  const m = html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m && m[1] ? m[1] : null;
}

function firstMatch(re: RegExp, html: string): string | null {
  const m = html.match(re);
  return m && m[1] ? m[1] : null;
}

/**
 * Best-effort metadata from the public channel preview HTML at t.me/s/<user>.
 * Used for instant UX on channel add. The worker performs the authoritative
 * resolution via MTProto (resolveUsername).
 */
export async function fetchChannelPreview(
  username: string,
  timeoutMs = 8000,
): Promise<ChannelPreview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(PREVIEW_URL(username), {
      headers: { "user-agent": UA, "accept-language": "ru,en;q=0.8" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { username, title: "", description: "", avatarUrl: null, postCount: null, exists: false };
    }
    const html = await res.text();

    const title =
      firstMatch(/<div class="tgme_page_title[^"]*"[^>]*>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/i, html) ??
      firstMatch(/<meta property="og:title" content="([^"]+)"/i, html) ??
      "";
    const description =
      firstMatch(/<div class="tgme_page_description[^"]*"[^>]*>(.*?)<\/div>/is, html) !== null
        ? stripTags(firstMatch(/<div class="tgme_page_description[^"]*"[^>]*>(.*?)<\/div>/is, html) ?? "")
        : "";
    const avatarUrl =
      attr("style", firstMatch(/<div class="tgme_page_photo_image"[^>]*style="[^"]*"/i, html) ?? "") !== null
        ? (firstMatch(/tgme_page_photo_image\"[^>]*style=\"[^\"]*url\('([^']+)'\)/i, html) ??
          firstMatch(/tgme_page_photo_image\"[^>]*style=\"[^\"]*url\(\"([^\"]+)\"\)/i, html))
        : null;
    const postCountRaw = firstMatch(/<span class="tgme_page_extra[^"]*"[^>]*>([^<]+?)<\/span>/i, html);

    const parsed = { title: stripTags(title), description };

    return {
      username,
      title: parsed.title,
      description: parsed.description,
      avatarUrl,
      postCount: parsePostCount(postCountRaw ?? ""),
      exists: parsed.title.length > 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parsePostCount(raw: string): number | null {
  // Examples: "1 234 subscribers", "12 subscribers", "500 members"
  const digits = raw.replace(/\s/g, "");
  const m = digits.match(/^(\d+)/);
  return m && m[1] ? Number.parseInt(m[1], 10) : null;
}

export interface PreviewPost {
  id: number;
  text: string;
  views: number | null;
  hasPhoto: boolean;
  photoUrl: string | null;
  date: string | null;
}

const TEXT_RE = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const VIEWS_RE = /<span class="tgme_widget_message_views[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i;
const DATE_RE = /<time datetime="([^"]+)"/i;
// Photo markup on t.me/s/<user> has changed over time: either
//   <a class="tgme_widget_message_photo" style="background-image:url('…')">…
// or the current
//   <a class="tgme_widget_message_photo_wrap {w} {locid} {id}" href="…" style="width:…;background-image:url('…')">
// (an <img class="tgme_widget_message_photo" src="…"> fallback is also supported).
const PHOTO_LINK_RE = /<a class="tgme_widget_message_photo[^"]*"[^>]*>/i;
const PHOTO_BG_RE = /background-image:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i;
const PHOTO_IMG_RE = /<img[^>]+class="tgme_widget_message_photo[^"]*"[^>]+src="([^"]+)"/i;

function photoOf(block: string): { hasPhoto: boolean; photoUrl: string | null } {
  const img = block.match(PHOTO_IMG_RE);
  if (img?.[1]) return { hasPhoto: true, photoUrl: img[1] };
  const wrap = block.match(PHOTO_LINK_RE);
  const bg = wrap?.[0] ? wrap[0].match(PHOTO_BG_RE) : null;
  return bg?.[1] ? { hasPhoto: true, photoUrl: bg[1] } : { hasPhoto: false, photoUrl: null };
}

function htmlToText(html: string): string {
  const cleaned = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  return decodeNumericEntities(cleaned).replace(/\u00a0/g, " ").replace(/\r/g, "").trim();
}

/** "1.2K", "3.5M", "1 234" → exact integer; null when absent. */
export function parsePreviewViews(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/,/g, ".");
  const m = cleaned.match(/^([\d.]+)([KM])?$/i);
  if (!m || !m[1]) return null;
  const value = Number.parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  const mult = m[2] ? (m[2].toUpperCase() === "K" ? 1_000 : 1_000_000) : 1;
  return Math.round(value * mult);
}

/**
 * Extract posts from a t.me/s/<user> channel preview page. Pure function,
 * no I/O — used by the worker's public-preview driver (no MTProto login).
 */
export function parseChannelMessages(html: string): PreviewPost[] {
  // Split on every message widget opening <div class="tgme_widget_message ...">.
  // Each segment is one message (service messages included), so a service
  // message never bleeds into the previous post's block.
  const openings = [
    // Class token must end at a space/quote/> — not at "_text" or "_photo".
    ...html.matchAll(/<div class="tgme_widget_message(?:[ "]|>)[^>]*>/g),
  ];
  const posts: PreviewPost[] = [];
  for (let i = 0; i < openings.length; i += 1) {
    const match = openings[i];
    if (!match) continue;
    const opening = match[0];
    if (opening.includes("tgme_widget_message_service_message")) continue;
    const dataPost = opening.match(/data-post="([^"]+)"/);
    const postRef = dataPost?.[1];
    if (!postRef) continue;
    const next = openings[i + 1];
    const block = html.slice(
      match.index + opening.length,
      next ? next.index - 1 : html.length,
    );
    const id = Number(postRef.split("/")[1]);
    if (!Number.isFinite(id)) continue;

    const textMatch = block.match(TEXT_RE);
    const viewsMatch = block.match(VIEWS_RE);
    const dateMatch = block.match(DATE_RE);
    const photo = photoOf(block);

    posts.push({
      id,
      text: textMatch?.[1] ? htmlToText(textMatch[1]) : "",
      views: viewsMatch?.[1] ? parsePreviewViews(viewsMatch[1]) : null,
      hasPhoto: photo.hasPhoto,
      photoUrl: photo.photoUrl,
      // Per-message date comes from the visible <time datetime>. The message
      // widget's `data-view` token must NOT be used for this: its `t` field is
      // the page render time, identical for every message on the preview page.
      date: dateMatch?.[1] ?? null,
    });
  }
  return posts;
}