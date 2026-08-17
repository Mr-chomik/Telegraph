import { describe, expect, it } from "vitest";
import {
  applyAiModifier,
  articleFooter,
  classifyPost,
  computeImportance,
  formatPostTime,
  importanceLevel,
  isFunnyText,
  isUrgent,
  mergeAiDraft,
  sentimentOf,
  spamScores,
  sourcesDisagree,
  writeEditorial,
} from "../../editorial/index";
import { jaccard } from "../../lib/lang";

describe("spamScores", () => {
  it("flags obvious ad text as rejectable", () => {
    const s = spamScores("Скидка! Распродажа! Промокод! Выиграй приз!", 1);
    expect(s.adScore).toBeGreaterThanOrEqual(70);
  });

  it("treats empty fragments as spam", () => {
    const s = spamScores("❯❯", 0);
    expect(s.spamScore).toBeGreaterThanOrEqual(60);
  });

  it("does not flag normal news", () => {
    const s = spamScores("Запуск исследовательского спутника прошёл успешно.", 0);
    expect(s.adScore).toBeLessThan(70);
    expect(s.spamScore).toBeLessThan(70);
  });
});

describe("classifyPost", () => {
  it("classifies technology news", () => {
    const r = classifyPost("Разработка нового смартфона и обновление приложения.", null);
    expect(r.categoryKey).toBe("tech");
  });

  it("uses channel category as a hint", () => {
    const r = classifyPost("Сегодня в мире много событий.", "world");
    expect(r.categoryKey).toBe("world");
  });

  it("falls back to misc with low confidence", () => {
    const r = classifyPost("qwerty zxcvbn asdfgh.", null);
    expect(r.categoryKey).toBe("misc");
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe("importance", () => {
  const base = {
    channelPriority: 2,
    categoryWeight: 1.2,
    hoursOld: 1,
    views: 5000,
    sourcesCount: 1,
    urgent: false,
    classified: { categoryKey: "main", confidence: 1 },
    spam: { adScore: 0, spamScore: 0 },
  };

  it("scores breaking, multi-source stories highest", () => {
    const normal = computeImportance(base);
    const breaking = computeImportance({ ...base, urgent: true, sourcesCount: 5, hoursOld: 0.2 });
    expect(breaking.importance).toBeGreaterThan(normal.importance);
    expect(breaking.urgency).toBe(true);
  });

  it("penalizes spammy posts", () => {
    const clean = computeImportance(base);
    const spammy = computeImportance({ ...base, spam: { adScore: 80, spamScore: 80 } });
    expect(spammy.importance).toBeLessThan(clean.importance);
  });

  it("levels map to expected buckets and AI modifier is bounded", () => {
    expect(importanceLevel(20)).toBe("irrelevant");
    expect(importanceLevel(45)).toBe("normal");
    expect(importanceLevel(95)).toBe("major");
    expect(applyAiModifier(50, 100)).toBe(65);
    expect(applyAiModifier(50, null)).toBe(50);
  });
});

describe("editorial writing", () => {
  it("is deterministic and produces a headline from lead text", () => {
    const text = "Правительство представило новый план развития экономики. Эксперты оценили подход.";
    const a = writeEditorial(text, { language: "ru", urgent: false, sourcesCount: 1, uncertain: false });
    const b = writeEditorial(text, { language: "ru", urgent: false, sourcesCount: 1, uncertain: false });
    expect(a).toEqual(b);
    expect(a.headline.length).toBeGreaterThan(5);
    expect(a.longForm).toContain(a.summary);
  });

  it("keeps the headline shorter than the article and never repeats it verbatim", () => {
    const text = "Правительство анонсировало новый национальный проект. Запуск исследовательского спутника прошёл успешно.";
    const out = writeEditorial(text, { language: "ru", urgent: false, sourcesCount: 2, uncertain: false });
    expect(out.headline.length).toBeLessThan(out.longForm.length);
    expect(out.longForm.toLowerCase()).not.toContain(out.headline.toLowerCase());
  });

  it("drops weak verbs from the headline", () => {
    const out = writeEditorial("Крупное отключение электроэнергии произошло в Алма-Ате.", {
      language: "ru",
      urgent: false,
      sourcesCount: 1,
      uncertain: false,
    });
    expect(out.headline).toContain("Алма-Ате");
    expect(out.headline.toLowerCase()).not.toContain("произошло");
  });

  it("produces an emoji-free, link-free headline from noisy lead text", () => {
    const out = writeEditorial("🔥 Срочно: 🚀 Ракета SpaceX успешно выведена на орбиту. https://example.com/launch", {
      language: "ru",
      urgent: true,
      sourcesCount: 1,
      uncertain: false,
    });
    expect(out.headline).toContain("Ракета");
    expect(out.headline.toLowerCase()).not.toContain("срочно");
    expect(out.headline).not.toMatch(/🚀|🔥/u);
    expect(out.headline).not.toContain("http");
    expect(out.summary).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("strips a leading time token and bullets from the headline", () => {
    const out = writeEditorial("— 08:30 Курс доллара вырос до уровня 2022 года.", {
      language: "ru",
      urgent: false,
      sourcesCount: 1,
      uncertain: false,
    });
    expect(out.headline).toContain("Курс доллара");
    expect(out.headline).not.toMatch(/^\s*—/);
    expect(out.headline).not.toMatch(/^\d{1,2}:\d{2}/);
  });

  it("collapses repeated punctuation in the headline", () => {
    const out = writeEditorial("Авария на трассе! Перекрыто движение!! Ожидаются заторы!!!", {
      language: "ru",
      urgent: true,
      sourcesCount: 1,
      uncertain: false,
    });
    expect(out.headline).not.toMatch(/!!/);
  });

  it("notes uncertainty and multi-source reporting", () => {
    const text = "Стороны подписали соглашение. Подробности уточняются.";
    const out = writeEditorial(text, { language: "en", urgent: false, sourcesCount: 3, uncertain: true });
    expect(out.summary).toContain("Reports differ");
    const footer = articleFooter({ language: "en", sourcesCount: 3, channelTitle: "News", publishedAt: new Date("2026-08-14T08:17:12Z") });
    expect(footer).toContain("3 sources");
    expect(footer).toContain("Source: News.");
    expect(footer).toContain("Published:");
  });

  it("formats the post time and puts it last in the footer", () => {
    const d = new Date("2026-08-14T08:17:12Z");
    expect(formatPostTime(d, "ru")).toMatch(/август/);
    const footer = articleFooter({ language: "ru", sourcesCount: 1, channelTitle: null, publishedAt: d });
    expect(footer).toContain("Опубликовано:");
    expect(footer.split("\n").pop()).toContain("Опубликовано:");
  });

  it("only accepts AI text that is non-trivial", () => {
    const det = writeEditorial("Правительство представило долгосрочный план развития.", { language: "ru", urgent: false, sourcesCount: 1, uncertain: false });
    const merged = mergeAiDraft(det, { headline: "X", summary: "tiny" });
    expect(merged).toEqual(det);
  });

  it("detects urgency and evergreens", () => {
    expect(isUrgent("Срочно: начался прямой эфир")).toBe(true);
    expect(isUrgent("Обычная новость про урожай")).toBe(false);
    expect(isFunnyText("Кот и мем сегодня 😂", 0.2, 15, null)).toBe(true);
    expect(isFunnyText("Запуск спутника успешно завершён", 0.2, 70, null)).toBe(false);
  });
});

describe("uncertainty", () => {
  it("flags conflicting reports, not duplicates", () => {
    const dup = ["Один и тот же текст новости.", "Один и тот же текст новости."];
    expect(sourcesDisagree(dup, jaccard)).toBe(false);
    const clash = ["Кандидат выиграл выборы.", "Кандидат снял свою кандидатуру."];
    expect(sourcesDisagree(clash, jaccard)).toBe(true);
  });
});

describe("sentiment", () => {
  it("distinguishes positive from negative text", () => {
    expect(sentimentOf("Экономика продемонстрировала рост и успех. Договорились о соглашении.")).toBeGreaterThan(0);
    expect(sentimentOf("Произошла катастрофа, авария и кризис.")).toBeLessThan(0);
    expect(sentimentOf("Нейтральный текст.")).toBe(0);
  });
});