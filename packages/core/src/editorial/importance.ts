import { URGENT_MARKERS } from "./lexicons";
import { clamp } from "../lib/lang";
import type { ImportanceResult, SpamScores, ClassificationResult } from "./types";

export interface ImportanceSignals {
  channelPriority: number; // 1 (highest) .. 10
  categoryWeight: number; // category.importanceWeight (0.4..1.4)
  hoursOld: number;
  views: number | null;
  sourcesCount: number; // size of the story cluster
  urgent: boolean;
  classified: ClassificationResult;
  spam: SpamScores;
  adScorePenalty?: number;
}

/**
 * Multi-signal editorial importance score (0..100). Purely deterministic —
 * AI assessment, when available, is applied later as a bounded modifier.
 */
export function computeImportance(signals: ImportanceSignals): ImportanceResult {
  const { channelPriority, categoryWeight, hoursOld, views, sourcesCount, urgent, spam } = signals;

  // 1) Source priority → up to 30
  const priorityScore = clamp((11 - channelPriority) * 3, 0, 30);

  // 2) Category editorial weight → up to 14 (weight 0.4..1.4)
  const categoryScore = clamp(categoryWeight * 10, 4, 14);

  // 3) Recency → up to 30, decaying after ~15 hours
  const recencyScore = clamp(30 - hoursOld * 2, 0, 30);

  // 4) Engagement → up to 5 (diminishing returns)
  const engagementScore = views ? clamp(Math.log10(Math.max(views, 1)) * 1.25, 0, 5) : 0;

  // 5) Cluster breadth → every extra independent source adds +5 (cap 10)
  const clusterScore = clamp((Math.max(sourcesCount, 1) - 1) * 5, 0, 10);

  // 6) Urgency / breaking
  const urgencyScore = urgent ? 10 : 0;

  // 7) Spam & ad penalties
  const spamPenalty = Math.round((spam.adScore + spam.spamScore) / 2) * 0.12;

  const base = priorityScore + categoryScore + recencyScore + engagementScore + clusterScore + urgencyScore;
  const importance = Math.round(clamp(base - spamPenalty, 0, 100));

  return { importance, urgency: urgent };
}

/** Detect urgency/breaking markers in the text. */
export function isUrgent(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return URGENT_MARKERS.some((m) => lower.includes(m));
}

/** Optional AI assessment modifier (−15..+15), applied post-hoc by the runner. */
export function applyAiModifier(importance: number, aiDelta: number | null | undefined): number {
  if (aiDelta === null || aiDelta === undefined) return importance;
  return clamp(importance + Math.round(clamp(aiDelta, -15, 15)), 0, 100);
}