import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@fun/core";

/**
 * Serve locally downloaded Telegram photos (data/media/<channel>_<id>.jpg)
 * as static images. The path segment is resolved strictly inside the media
 * directory, so traversal is impossible.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const segments = (await params).path ?? [];
  const mediaDir = getEnv().mediaDir;
  const filePath = path.resolve(mediaDir, ...segments);
  if (!filePath.startsWith(mediaDir + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return new Response(buf, {
      headers: { "content-type": type, "cache-control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
