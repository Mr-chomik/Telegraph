/** Plain data types shared by the editorial pipeline (DB-agnostic). */

export interface EditorialPost {
  id: string;
  text: string;
  normalizedText: string;
  language: string | null;
  publishedAt: Date;
  views: number | null;
  channelPriority: number;
  channelCategoryKey: string | null;
  isForwarded: boolean;
}

export interface SpamScores {
  /** 0..100 likelihood this is advertisement / promo. */
  adScore: number;
  /** 0..100 likelihood this is low-value spam / meaningless repost. */
  spamScore: number;
}

export interface ClassificationResult {
  categoryKey: string;
  confidence: number; // 0..1
}

export interface ImportanceResult {
  importance: number; // 0..100
  urgency: boolean;
}

export interface SentimentResult {
  sentiment: number; // -1..1
  label: "negative" | "neutral" | "positive";
}

export interface EditorialFields {
  headline: string;
  summary: string;
  sentiment: number;
  isFunny: boolean;
}

export interface StoryDraft {
  clusterHash: string;
  headline: string;
  summary: string;
  longForm: string;
  categoryKey: string;
  confidence: number;
  importance: number;
  urgency: boolean;
  sentiment: number;
  isFunny: boolean;
  isUncertain: boolean;
  generatedLanguage: string;
}

export const IMPORTANCE_LEVELS = {
  irrelevant: [0, 20],
  low: [21, 40],
  normal: [41, 60],
  important: [61, 80],
  major: [81, 100],
} as const;

export function importanceLevel(importance: number): keyof typeof IMPORTANCE_LEVELS {
  if (importance <= 20) return "irrelevant";
  if (importance <= 40) return "low";
  if (importance <= 60) return "normal";
  if (importance <= 80) return "important";
  return "major";
}