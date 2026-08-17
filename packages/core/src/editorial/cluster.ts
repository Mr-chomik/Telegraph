import { createHash } from "node:crypto";
import { jaccard, tokenize, shingles } from "../lib/lang";

export interface ClusterItem {
  id: string;
  text: string;
  normalizedText: string;
  publishedAt: Date;
}

export interface Cluster<T> {
  representative: T;
  members: T[];
}

export interface ClusterOptions {
  /** Similarity threshold for considering two posts the same event (0..1). */
  similarityThreshold?: number;
}

/**
 * Similarity = max(4-shingle Jaccard, word-level Jaccard).
 * N-grams capture near-verbatim copy; word overlap catches light rewordings
 * where inserted words would have shifted the n-gram windows apart.
 */
function similarity(a: ClusterItem, b: ClusterItem): number {
  const aWords = tokenize(a.normalizedText);
  const bWords = tokenize(b.normalizedText);
  const sh4 = jaccard(shingles(a.normalizedText, 4), shingles(b.normalizedText, 4));
  const words = jaccard(new Set(aWords), new Set(bWords));
  const lenRatio = Math.max(aWords.length, bWords.length) / Math.max(1, Math.min(aWords.length, bWords.length));
  return lenRatio > 2.5 ? Math.min(sh4, 0.3) : Math.max(sh4, words);
}

/**
 * Group posts that describe the same event into stories (spec §10).
 * Deterministic: exact-normalized groups plus fuzzy merging. The cluster key
 * is derived from the earliest member (stable over time).
 */
export function clusterPosts<T extends ClusterItem>(posts: T[], opts: ClusterOptions = {}): Cluster<T>[] {
  const threshold = opts.similarityThreshold ?? 0.55;
  const ordered = [...posts].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  const clusters: Array<{ rep: T; members: T[] }> = [];

  for (const post of ordered) {
    if (post.normalizedText.length < 12) continue;
    let bestIdx = -1;
    let bestSim = threshold;
    for (let i = 0; i < clusters.length; i++) {
      const sim = similarity(clusters[i]!.rep, post);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      clusters[bestIdx]!.members.push(post);
    } else {
      clusters.push({ rep: post, members: [post] });
    }
  }

  return clusters
    .filter((c) => c.members.length > 0)
    .map((c) => ({ representative: c.rep, members: c.members }));
}

/** Stable cluster hash from the earliest (representative) post id. */
export function clusterHashOf(repId: string): string {
  return createHash("sha256").update(`cluster:${repId}`).digest("hex");
}