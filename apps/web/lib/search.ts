import "server-only";
import { Prisma, prisma } from "@fun/db";

export interface SearchResult {
  articleId: string;
  editionId: string;
  headline: string;
  summary: string | null;
  section: string;
  format: string;
  page: number;
  featured: boolean;
  editionDate: Date;
  editionLabel: string | null;
  rank: number;
}

const MAX_RESULTS = 50;

/**
 * Full-text search across article text, source channel names and category names,
 * ranked by PostgreSQL ts_rank and newest-first. Pure server-side PG query.
 */
export async function searchArticles(query: string, limit = MAX_RESULTS): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const config = /[а-яё]/i.test(q) ? "russian" : "english";

  const rows = await prisma().$queryRaw<SearchResult[]>(Prisma.sql`
    SELECT sub."articleId", sub."editionId", sub.headline, sub.summary, sub.section,
           sub.format, sub.page, sub.featured, sub."editionDate", sub."editionLabel",
           ts_rank(sub.tsv, sub.query)::float AS rank
    FROM (
      SELECT a.id      AS "articleId",
             e.id      AS "editionId",
             a.headline, a.summary, a.section, a.format, a.page, a.featured,
             e."editionDate", e.label AS "editionLabel",
             to_tsvector(${config}::regconfig,
               coalesce(a.headline, '') || ' ' || coalesce(a.summary, '') || ' ' || coalesce(a.body, '') ||
               ' ' || coalesce((SELECT string_agg("channelName", ' ') FROM "ArticleSource" WHERE "articleId" = a.id), '') ||
               ' ' || coalesce(cat.key, '') || ' ' || coalesce(cat."nameRu", '') || ' ' || coalesce(cat."nameEn", ''))
             AS tsv,
             plainto_tsquery(${config}::regconfig, ${q}) AS query
      FROM "Article" a
      JOIN "Edition" e ON e.id = a."editionId"
      LEFT JOIN "Story" st ON st.id = a."storyId"
      LEFT JOIN "Category" cat ON cat.id = st."categoryId"
    ) sub
    WHERE sub.tsv @@ sub.query
    ORDER BY rank DESC, sub."editionDate" DESC, sub.page ASC, sub.headline ASC
    LIMIT ${limit}
  `);

  return rows as SearchResult[];
}