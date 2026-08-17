import { Prisma } from "@fun/db";
import {
  aiRefinementEnabled,
  applyAiModifier,
  articleFooter,
  classifyPost,
  clusterHashOf,
  clusterPosts,
  computeImportance,
  createAiProvider,
  fetchFreshnessHours,
  getEnv,
  isEmptyLike,
  isFunnyText,
  isUrgent,
  jaccard,
  log,
  mergeAiDraft,
  normalizeText,
  sentimentOf,
  spamScores,
  sourcesDisagree,
  writeEditorial,
} from "@fun/core";
import { db } from "../db";
import type { JobContext } from "../scheduler";

interface PostRow {
  id: string;
  text: string;
  normalizedText: string | null;
  language: string | null;
  views: number | null;
  publishedAt: Date | null;
  channel: {
    id: string;
    title: string | null;
    priority: number;
    categoryId: string | null;
  } | null;
}

/**
 * M3 — editorial pipeline core. Deterministic by design; Ollama (if configured)
 * may refine headline/summary/long-form within an evidence guard.
 *
 * Steps:
 *  1. Load unprocessed (NEW) posts inside the freshness window (24h first
 *     run, else the interval between editions).
 *  2. Score ad/spam; reject obvious spam and empty fragments.
 *  3. Cluster the rest by near-duplicate text (exact + fuzzy n-gram Jaccard).
 *  4. For every cluster: classify, measure importance/sentiment/humor/uncertainty,
 *     write the editorial fields, optionally refine with AI, then upsert the
 *     Story + StoryPost rows (stable clusterHash ⇒ idempotent & incremental).
 *  5. Mark the source posts CLUSTERED / REJECTED with their scores.
 */
export async function processNewPosts(
  _payload: Record<string, never>,
  _ctx: JobContext,
): Promise<void> {
  void _payload;
  void _ctx;
  const env = getEnv();
  const startedAt = new Date();
  const job = await db.processingJob.create({
    data: { type: "process", status: "RUNNING", startedAt, attemptCount: 1, maxAttempts: 1 },
  });

  try {
    const categories = await db.category.findMany();
    const categoryById = new Map(categories.map((c) => [c.id, c] as const));
    const categoryByKey = new Map(categories.map((c) => [c.key, c] as const));

    // Only fresh posts: 24h on the very first run, afterwards the interval
    // between editions.
    const firstRun = (await db.telegramPost.count()) === 0;
    const freshnessHours = fetchFreshnessHours({ firstRun, editionTimes: env.editionTimes });
    const cutoff = new Date(Date.now() - freshnessHours * 3_600_000);
    const posts = (await db.telegramPost.findMany({
      where: { status: "NEW", publishedAt: { gte: cutoff } },
      orderBy: { publishedAt: "asc" },
      take: 500,
      include: { channel: { select: { id: true, title: true, priority: true, categoryId: true } } },
    })) as unknown as PostRow[];

    if (posts.length === 0) {
      await finishJob(job.id, { inserted: 0, updated: 0, rejected: 0, clusters: 0 });
      log.info("process — nothing to do");
      return;
    }

    const rejected: string[] = [];
    const candidates: PostRow[] = [];
    for (const post of posts) {
      const links = (post.text.match(/https?:\/\//g) ?? []).length;
      const spam = spamScores(post.text, links);
      const empty = isEmptyLike(post.text);
      if (spam.adScore >= 70 || empty) {
        rejected.push(post.id);
        await db.telegramPost.update({
          where: { id: post.id },
          data: {
            status: "REJECTED",
            adScore: spam.adScore,
            spamScore: spam.spamScore,
            importance: 0,
            processedAt: new Date(),
          },
        });
        continue;
      }
      await db.telegramPost.update({
        where: { id: post.id },
        data: { adScore: spam.adScore, spamScore: spam.spamScore },
      });
      candidates.push(post);
    }
    log.info("process — scored posts", { total: posts.length, rejected: rejected.length, candidates: candidates.length });

    const clusters = clusterPosts(
      candidates.map((p) => ({
        id: p.id,
        text: p.text,
        normalizedText:
          p.normalizedText && p.normalizedText.length > 0 ? p.normalizedText : normalizeText(p.text),
        publishedAt: p.publishedAt ?? new Date(),
      })),
      { similarityThreshold: 0.55 },
    );

    let inserted = 0;
    let updated = 0;
    const candidatesById = new Map(candidates.map((c) => [c.id, c] as const));

    for (const cluster of clusters) {
      const memberRows = cluster.members.map((m) => candidatesById.get(m.id)!).filter((m): m is PostRow => Boolean(m));
      const rep = memberRows[0]!;
      const repText = rep.text;
      const language = rep.language ?? env.defaultLanguage;
      const repCategoryKey = categoryById.get(rep.channel?.categoryId ?? "")?.key ?? null;
      const hash = clusterHashOf(rep.id);

      const existing = await db.story.findUnique({
        where: { clusterHash: hash },
        include: { posts: { select: { telegramPostId: true } } },
      });

      const memberTexts = memberRows.map((m) => m.text);
      const classified = classifyPost(repText, repCategoryKey);
      const urgent = isUrgent(repText);
      const categoryWeight =
        categoryByKey.get(classified.categoryKey)?.importanceWeight ??
        categoryByKey.get(repCategoryKey ?? "")?.importanceWeight ??
        1.0;
      const categoryId =
        categoryByKey.get(classified.categoryKey)?.id ??
        categoryById.get(rep.channel?.categoryId ?? "")?.id ??
        categoryByKey.get("misc")?.id ??
        null;
      const channelPriority = Math.min(...memberRows.map((m) => m.channel?.priority ?? 10));
      const hoursOld = Math.max(0, (Date.now() - (rep.publishedAt?.getTime() ?? Date.now())) / 3_600_000);
      const maxViews = Math.max(0, ...memberRows.map((m) => m.views ?? 0));
      const sourcesCount = memberRows.length;

      const importanceResult = computeImportance({
        channelPriority,
        categoryWeight,
        hoursOld,
        views: maxViews > 0 ? maxViews : null,
        sourcesCount,
        urgent,
        classified,
        spam: { adScore: 0, spamScore: 0 },
      });
      const sentiment = sentimentOf(repText);
      const isUncertain = sourcesDisagree(memberTexts, jaccard);
      const isFunny = isFunnyText(repText, sentiment, importanceResult.importance, repCategoryKey);
      const written = writeEditorial(repText, {
        language,
        urgent,
        sourcesCount,
        uncertain: isUncertain,
      });

      // Optional AI refinement — only for stories worth the tokens, once.
      const aiAllowed = existing?.aiInfo
        ? (existing.aiInfo as { aiRefined?: boolean } | null)?.aiRefined !== true
        : true;
      const shouldUseAi =
        aiAllowed &&
        aiRefinementEnabled(env) &&
        (env.aiMode === "full" || importanceResult.importance >= 30);

      let headline = written.headline;
      let summary = written.summary;
      let longForm = written.longForm;
      let importance = importanceResult.importance;
      let uncertainty = isUncertain;
      let aiInfo: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = Prisma.JsonNull;

      if (shouldUseAi) {
        const provider = createAiProvider(env);
        const refined = await provider.refine({
          language,
          sources: memberTexts,
          draftHeadline: written.headline,
          draftSummary: written.summary,
        });
        if (refined) {
          const merged = mergeAiDraft(written, {
            headline: refined.headline,
            summary: refined.summary,
            longForm: refined.longForm,
          });
          headline = merged.headline;
          summary = merged.summary;
          longForm = merged.longForm;
          importance = applyAiModifier(importance, refined.importanceDelta);
          uncertainty = uncertainty || refined.uncertainty === true;
          aiInfo = { aiRefined: true, provider: provider.name } as Prisma.InputJsonValue;
        }
      }

      // Every article ends with the primary source and the news-post publish
      // time (appended after any AI refinement so it is always present).
      const footer = articleFooter({
        language,
        sourcesCount,
        channelTitle: rep.channel?.title ?? null,
        publishedAt: rep.publishedAt,
      });
      if (footer.length > 0) {
        longForm = `${longForm}\n\n${footer}`;
      }

      const storyData = {
        clusterHash: hash,
        headline,
        summary,
        longForm,
        generatedLanguage: language,
        status: existing?.status ?? ("DRAFT" as const),
        importance,
        sentiment,
        urgency: importanceResult.urgency,
        isFunny,
        isUncertain: uncertainty,
        confidence: classified.confidence,
        sourcesCount,
        primaryPostId: rep.id,
        categoryId,
        firstPostAt: rep.publishedAt,
        lastPostAt: new Date(Math.max(...memberRows.map((m) => m.publishedAt?.getTime() ?? 0)) || Date.now()),
      };

      const story = existing
        ? await db.story.update({
            where: { id: existing.id },
            data:
              existing.status === "DRAFT"
                ? { ...storyData, aiInfo }
                : { lastPostAt: storyData.lastPostAt },
          })
        : await db.story.create({ data: { ...storyData, aiInfo } });

      const knownPostIds = new Set((existing?.posts ?? []).map((sp) => sp.telegramPostId));
      const freshMembers = memberRows.filter((m) => !knownPostIds.has(m.id));
      if (freshMembers.length > 0) {
        await db.storyPost.createMany({
          data: freshMembers.map((m) => ({ storyId: story.id, telegramPostId: m.id, contribution: "primary" as const })),
          skipDuplicates: true,
        });
      }

      await db.telegramPost.updateMany({
        where: { id: { in: memberRows.map((m) => m.id) } },
        data: {
          status: "CLUSTERED",
          importance,
          sentiment,
          sentimentLabel: sentimentLabelOf(sentiment),
          processedAt: new Date(),
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    await finishJob(job.id, {
      total: posts.length,
      rejected: rejected.length,
      clusters: clusters.length,
      inserted,
      updated,
    });
    log.info("process complete", { clusters: clusters.length, inserted, updated, rejected: rejected.length });
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

function sentimentLabelOf(sentiment: number): string {
  if (sentiment > 0.1) return "positive";
  if (sentiment < -0.1) return "negative";
  return "neutral";
}

async function finishJob(id: string, payload: Record<string, unknown>): Promise<void> {
  await db.processingJob.update({
    where: { id },
    data: { status: "SUCCEEDED", payload: payload as Prisma.InputJsonValue, finishedAt: new Date() },
  });
}