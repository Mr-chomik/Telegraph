export const SECTION_LABELS: Record<string, { ru: string; en: string }> = {
  "front-page": { ru: "Первая полоса", en: "Front Page" },
  world: { ru: "Мир", en: "World" },
  europe: { ru: "Европа", en: "Europe" },
  russia: { ru: "Россия", en: "Russia" },
  technology: { ru: "Технологии", en: "Technology" },
  science: { ru: "Наука", en: "Science" },
  business: { ru: "Бизнес", en: "Business" },
  games: { ru: "Игры", en: "Games" },
  sports: { ru: "Спорт", en: "Sports" },
  culture: { ru: "Культура", en: "Culture" },
  "light-reading": { ru: "Лёгкое чтение", en: "Light Reading" },
  briefs: { ru: "Коротко", en: "Briefs" },
};

export const FORMAT_KICKER: Record<string, { ru: string; en: string }> = {
  URGENT: { ru: "Срочно", en: "Urgent" },
  MAJOR: { ru: "Главное", en: "Major" },
  BRIEF: { ru: "Коротко", en: "Brief" },
  FUNNY: { ru: "Забавное", en: "Light reading" },
};

export function sectionLabel(section: string | null, lang: "ru" | "en"): string {
  if (!section) return lang === "en" ? "News" : "Новости";
  return SECTION_LABELS[section]?.[lang] ?? section;
}

export function formatKicker(format: string, lang: "ru" | "en"): string | null {
  return FORMAT_KICKER[format]?.[lang] ?? null;
}
