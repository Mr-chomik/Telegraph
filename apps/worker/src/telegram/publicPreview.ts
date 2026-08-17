import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchChannelPreview, log, parseChannelMessages } from "@fun/core";
import type { ResolvedChannel } from "./client";

const PREVIEW_URL = (username: string): string =>
  `https://t.me/s/${encodeURIComponent(username)}`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface PreviewMessage {
  id: number;
  raw: Record<string, unknown>;
  mediaFiles: string[];
}

/**
 * Auth-free collection driver. Reads the *public* channel preview page
 * (t.me/s/<user>) that Telegram serves for broadcast channels, and extracts
 * text, views and photos. No api_id, no session, no MTProto connection.
 * Trade-off vs the MTProto driver: views are rounded ("1.2K"), no forwards,
 * and only the most recent ~20 posts are visible on the preview page.
 */
export class PublicPreviewManager {
  private readonly mediaDir: string;

  constructor(dataDir: string) {
    this.mediaDir = path.join(dataDir, "media");
    mkdirSync(this.mediaDir, { recursive: true });
  }

  async resolveChannel(username: string): Promise<ResolvedChannel | null> {
    const preview = await fetchChannelPreview(username);
    if (!preview || !preview.exists) return null;
    return {
      id: username,
      username,
      title: preview.title,
      description: preview.description,
      hasPhoto: preview.avatarUrl !== null,
    };
  }

  async getMessages(username: string, limit: number): Promise<PreviewMessage[]> {
    const res = await fetch(PREVIEW_URL(username), {
      headers: { "user-agent": UA, "accept-language": "ru,en;q=0.8" },
    });
    if (!res.ok) {
      throw new Error(`channel preview unavailable (HTTP ${res.status})`);
    }
    const html = await res.text();
    const posts = parseChannelMessages(html).slice(0, limit);

    return Promise.all(
      posts.map(async (p) => ({
        id: p.id,
        raw: {
          type: "message",
          id: p.id,
          date: p.date,
          text: p.text,
          views: p.views,
          hasPhoto: p.hasPhoto,
        },
        mediaFiles: p.photoUrl ? await this.savePhoto(username, p.id, p.photoUrl) : [],
      })),
    );
  }

  private async savePhoto(username: string, id: number, url: string): Promise<string[]> {
    const filePath = path.join(this.mediaDir, `${username}_${id}.jpg`);
    if (existsSync(filePath)) return [filePath];
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (!res.ok) return [];
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return [];
      writeFileSync(filePath, buf);
      return [filePath];
    } catch (err) {
      log.warn("public-preview: photo download skipped", { channel: username, err: String(err) });
      return [];
    }
  }
}