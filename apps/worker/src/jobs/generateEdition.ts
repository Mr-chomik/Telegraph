import { Prisma } from "@fun/db";
import {
  buildEditionLayout,
  editionLabel,
  fetchFreshnessHours,
  getEnv,
  log,
  totalPages,
  type PlacedStory,
} from "@fun/core";
import { db } from "../db";
import type { JobContext } from "../scheduler";

export interface GenerateEditionPayload {
  kind: "MORNING" | "AFTERNOON" | "EVENING";
  date: string;
}

interface StoryRow {
  id: string;
  headline: string | null;
  summary: string | null;
  longForm: string | null;
  status: string;
  importance: number | null;
  urgency: boolean | null;
  isFunny: boolean | null;
  isUncertain: boolean | null;
  generatedLanguage: string | null;
  firstPostAt: Date | null;
  categoryId: string | null;
  posts: {
    post: {
      id: string;
      telegramMessageId: number | null;
      mediaCount: number | null;
      channel: { title: string | null; telegramUsername: string | null } | null;
      media: { id: string; kind: string; localPath: string | null; caption: string | null }[];
    };
  }[];
}

const MIN_IMPORTANCE_FOR_DRAFT = 30;
const MAX_STORIES = 40;

/**
 * M4 — edition assembly. Deterministic by design (spec §14 / §7):
 *
 *  1. Pick qualified stories (ACCEPTED, or DRAFT above a quality bar) that are
 *     not already placed in a published edition.
 *  2. Compose pages/sections with the pure layout engine.
 *  3. Persist one Edition (unique kind + editionDate) with its Articles and
 *     traceable ArticleSource rows in a single transaction.
 *
 * Idempotent: if an edition for (kind, editionDate) already exists it is left
 * untouched, so re-runs never clobber a published paper.
 */
export async function generateEdition(
  payload: GenerateEditionPayload,
  ctx: JobContext,
): Promise<void> {
  void ctx;
  const env = getEnv();
  const startedAt = new Date();
  const job = await db.processingJob.create({
    data: { type: "edition", status: "RUNNING", startedAt, attemptCount: 1, maxAttempts: 1 },
  });

  try {
    const editionDate = new Date(`${payload.date}T12:00:00`);
    const existing = await db.edition.findFirst({
      where: { kind: payload.kind, editionDate },
      select: { id: true, label: true },
    });
    if (existing) {
      log.info("generate-edition — already exists, skipping", {
        kind: payload.kind,
        date: payload.date,
        id: existing.id,
      });
      await finishJob(job.id, { editionId: existing.id, created: false });
      return;
    }

    const categories = await db.category.findMany();
    const categoryKeyById = new Map(categories.map((c) => [c.id, c.key] as const));

    const usedStoryIds = await usedStoryIdsAcrossEditions();

    // Only fresh stories belong in a paper: 24h on the very first edition,
    // afterwards the interval between editions.
    const firstRun = (await db.edition.count()) === 0;
    const freshnessHours = fetchFreshnessHours({ firstRun, editionTimes: env.editionTimes });
    const freshnessCutoff = new Date(Date.now() - freshnessHours * 3_600_000);

    const stories = (await db.story.findMany({
      where: {
        NOT: { id: { in: usedStoryIds } },
        OR: [
          { status: "ACCEPTED" },
          { status: "DRAFT", importance: { gte: MIN_IMPORTANCE_FOR_DRAFT } },
        ],
        AND: { firstPostAt: { gte: freshnessCutoff } },
      },
      orderBy: [{ importance: "desc" }, { firstPostAt: "asc" }],
      take: MAX_STORIES,
      select: {
        id: true,
        headline: true,
        summary: true,
        longForm: true,
        status: true,
        importance: true,
        urgency: true,
        isFunny: true,
        isUncertain: true,
        generatedLanguage: true,
        firstPostAt: true,
        categoryId: true,
        posts: {
          select: {
            post: {
              select: {
                id: true,
                telegramMessageId: true,
                mediaCount: true,
                channel: { select: { title: true, telegramUsername: true } },
                media: { select: { id: true, kind: true, localPath: true, caption: true } },
              },
            },
          },
        },
      },
    })) as unknown as StoryRow[];

    if (stories.length === 0) {
      log.info("generate-edition — no qualified stories to place");
      await finishJob(job.id, { created: false, stories: 0 });
      return;
    }

    const lang = dominantLanguage(stories) ?? env.defaultLanguage ?? "ru";
    const placed: PlacedStory[] = stories.map((s) => ({
      id: s.id,
      headline: s.headline ?? "",
      summary: s.summary ?? "",
      longForm: s.longForm ?? s.summary ?? s.headline ?? "",
      importance: s.importance ?? 0,
      urgency: s.urgency ?? false,
      isFunny: s.isFunny ?? false,
      categoryKey: s.categoryId ? (categoryKeyById.get(s.categoryId) ?? "misc") : "misc",
      language: s.generatedLanguage ?? lang,
      firstPostAt: s.firstPostAt ?? new Date(),
      sourcesCount: s.posts.length,
      hasMedia: s.posts.some((p) => (p.post.mediaCount ?? 0) > 0),
    }));

    const layout = buildEditionLayout(placed, lang);
    if (!layout) {
      log.info("generate-edition — layout engine produced nothing");
      await finishJob(job.id, { created: false, stories: placed.length });
      return;
    }

    const storyById = new Map(stories.map((s) => [s.id, s] as const));
    const articleCreates = layout.pages.flatMap((page) =>
      page.articles.map((a) => {
        const story = storyById.get(a.storyId)!;
        const image = pickStoryImage(story, a.format);
        return {
          storyId: story.id,
          page: a.page,
          pageOrder: a.pageOrder,
          section: a.section,
          sectionIndex: a.sectionIndex,
          format: a.format,
          headline: story.headline ?? "",
          summary: story.summary ?? "",
          body: story.longForm ?? story.summary ?? story.headline ?? "",
          featured: a.featured,
          isUncertain: story.isUncertain ?? false,
          imageMediaId: image?.mediaId ?? null,
          layout: {
            kind: page.kind,
            teaser: a.teaser,
            cover: page.page === 1,
            media: image ? { path: image.localPath, caption: image.caption } : null,
          },
          sources: {
            create: storySources(story),
          },
        };
      }),
    );

    const pageCount = totalPages(layout);
    const edition = await db.edition.create({
      data: {
        kind: payload.kind,
        editionDate,
        label: editionLabel(payload.kind, editionDate, lang),
        pageCount,
        status: "GENERATED",
        publishedAt: new Date(),
        configSnapshot: {
          masthead: layout.masthead,
          pages: layout.pages.map((p) => ({
            page: p.page,
            kind: p.kind,
            section: p.section,
            count: p.articles.length,
          })),
        },
        articles: { create: articleCreates },
      },
    });

    await finishJob(job.id, {
      editionId: edition.id,
      created: true,
      stories: placed.length,
      pages: pageCount,
      articles: articleCreates.length,
    });
    log.info("generate-edition complete", {
      id: edition.id,
      kind: payload.kind,
      date: payload.date,
      pages: pageCount,
      articles: articleCreates.length,
    });
  } catch (err) {
    await db.processingJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

/**
 * Decide whether an article needs an image. Clear rule: an image is used only
 * when the story actually carries a downloaded photo AND the article is a main
 * article — short BRIEF teasers stay text-only. The first usable photo of the
 * story's posts is picked.
 */
function pickStoryImage(
  story: StoryRow,
  format: string,
): { mediaId: string; localPath: string; caption: string | null } | null {
  if (format === "BRIEF") return null;
  for (const sp of story.posts) {
    const photo = sp.post.media.find((m) => m.kind === "PHOTO" && m.localPath);
    if (photo && photo.localPath) {
      return { mediaId: photo.id, localPath: photo.localPath, caption: photo.caption ?? null };
    }
  }
  return null;
}

function storySources(story: StoryRow): {
  telegramPostId: string;
  channelName: string;
  channelUsername: string;
  messageId: number | null;
  url: string | null;
}[] {
  return story.posts.map((p) => {
    const tp = p.post;
    const username = tp.channel?.telegramUsername ?? "";
    const messageId = tp.telegramMessageId ?? null;
    const url =
      username && messageId != null ? `https://t.me/${username}/${messageId}` : null;
    return {
      telegramPostId: tp.id,
      channelName: tp.channel?.title ?? "",
      channelUsername: username,
      messageId,
      url,
    };
  });
}

function dominantLanguage(stories: StoryRow[]): string | null {
  const counts = new Map<string, number>();
  for (const s of stories) {
    const lang = s.generatedLanguage;
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

async function usedStoryIdsAcrossEditions(): Promise<string[]> {
  const articles = await db.article.findMany({
    select: { storyId: true },
  });
  const ids = articles.map((a) => a.storyId).filter((id): id is string => Boolean(id));
  return ids.length > 0 ? [...new Set(ids)] : [];
}

async function finishJob(id: string, payload: Record<string, unknown>): Promise<void> {
  await db.processingJob.update({
    where: { id },
    data: { status: "SUCCEEDED", payload: payload as Prisma.InputJsonValue, finishedAt: new Date() },
  });
}