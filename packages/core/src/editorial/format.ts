export type ArticleFormat = "MAJOR" | "STANDARD" | "BRIEF" | "FUNNY" | "URGENT";

export interface FormatSignals {
  importance: number;
  urgent: boolean;
  isFunny: boolean;
  hasMedia: boolean;
  textLength: number;
}

/** Choose the article layout from editorial state (spec §14). */
export function selectFormat(signals: FormatSignals): ArticleFormat {
  const { importance, urgent, isFunny } = signals;
  if (urgent && importance >= 60) return "URGENT";
  if (isFunny) return "FUNNY";
  if (importance >= 81) return "MAJOR";
  if (importance >= 61) return "STANDARD";
  if (importance >= 41) return "BRIEF";
  return "BRIEF";
}

/** Category key → newspaper section slug. Light Reading is a section, not a category. */
export function sectionForCategory(categoryKey: string, isFunny: boolean): string {
  if (isFunny) return "light-reading";
  switch (categoryKey) {
    case "main":
      return "front-page";
    case "world":
      return "world";
    case "europe":
      return "europe";
    case "russia":
      return "russia";
    case "tech":
      return "technology";
    case "science":
      return "science";
    case "business":
      return "business";
    case "games":
      return "games";
    case "sports":
      return "sports";
    case "culture":
      return "culture";
    default:
      return "briefs";
  }
}