import { describe, expect, it } from "vitest";
import {
  buildEditionLayout,
  editionLabel,
  kindLabelOf,
  LIGHT_READING_SECTION,
  type PlacedStory,
} from "../../editorial/index";

function story(partial: Partial<PlacedStory>): PlacedStory {
  return {
    id: partial.id ?? `s${Math.random().toString(36).slice(2, 8)}`,
    headline: partial.headline ?? "Заголовок",
    summary: partial.summary ?? "Краткое содержание статьи.",
    longForm: partial.longForm ?? "Полный текст статьи.",
    importance: partial.importance ?? 50,
    urgency: partial.urgency ?? false,
    isFunny: partial.isFunny ?? false,
    categoryKey: partial.categoryKey ?? "world",
    language: partial.language ?? "ru",
    firstPostAt: partial.firstPostAt ?? new Date("2026-08-12T08:00:00Z"),
    sourcesCount: partial.sourcesCount ?? 2,
    hasMedia: partial.hasMedia ?? false,
  };
}

describe("buildEditionLayout", () => {
  it("returns null for an empty story set", () => {
    expect(buildEditionLayout([], "ru")).toBeNull();
  });

  it("produces a single-page edition for one story", () => {
    const layout = buildEditionLayout([story({})], "ru");
    expect(layout).not.toBeNull();
    expect(layout!.pages.length).toBe(1);
    expect(layout!.pages[0]!.kind).toBe("cover");
    expect(layout!.pages[0]!.articles.length).toBe(1);
    expect(layout!.pages[0]!.articles[0]!.featured).toBe(true);
  });

  it("cover teasers are briefs, body stories stay on their section pages", () => {
    const s1 = story({ id: "a", importance: 90, categoryKey: "world" });
    const s2 = story({ id: "b", importance: 80, categoryKey: "world" });
    const s3 = story({ id: "c", importance: 70, categoryKey: "world" });
    const layout = buildEditionLayout([s1, s2, s3], "ru", { maxCoverTeasers: 1 });
    expect(layout!.pages[0]!.articles.map((a) => a.storyId)).toEqual(["a", "b"]);
    expect(layout!.pages[0]!.articles[1]!.format).toBe("BRIEF");
    expect(layout!.pages[0]!.articles[1]!.teaser).toBe(true);
    // s2 is a teaser only — it does not repeat in the body.
    const bodyStories = layout!.pages.slice(1).flatMap((p) => p.articles.map((a) => a.storyId));
    expect(bodyStories).not.toContain("b");
    expect(bodyStories).toEqual(["c"]);
  });

  it("groups stories by section in canonical order", () => {
    const s1 = story({ id: "lead", importance: 95, categoryKey: "world" });
    const s2 = story({ id: "tech1", importance: 40, categoryKey: "tech" });
    const s3 = story({ id: "tech2", importance: 39, categoryKey: "tech" });
    const s4 = story({ id: "sport", importance: 38, categoryKey: "sports" });
    const layout = buildEditionLayout([s1, s2, s3, s4], "ru", { maxCoverTeasers: 1 });
    expect(layout!.pages.length).toBe(3); // cover + technology + sports
    expect(layout!.pages[1]!.section).toBe("technology");
    expect(layout!.pages[2]!.section).toBe("sports");
    expect(layout!.pages[1]!.articles.map((a) => a.storyId)).toEqual(["tech2"]);
    expect(layout!.pages[2]!.articles.map((a) => a.storyId)).toEqual(["sport"]);
  });

  it("never mixes sections on one page", () => {
    const stories = [
      story({ id: "lead", importance: 95, categoryKey: "world" }),
      story({ id: "t1", importance: 40, categoryKey: "tech" }),
      story({ id: "s1", importance: 38, categoryKey: "sports" }),
    ];
    const layout = buildEditionLayout(stories, "ru", { maxCoverTeasers: 1 });
    for (const page of layout!.pages) {
      const sections = new Set(page.articles.map((a) => a.section));
      expect(sections.size).toBe(1);
    }
  });

  it("pages hold at most three body stories", () => {
    const stories = [
      story({ id: "lead", importance: 95, categoryKey: "world" }),
      story({ id: "w1", importance: 50, categoryKey: "world" }),
      story({ id: "w2", importance: 49, categoryKey: "world" }),
      story({ id: "w3", importance: 48, categoryKey: "world" }),
      story({ id: "w4", importance: 47, categoryKey: "world" }),
      story({ id: "w5", importance: 46, categoryKey: "world" }),
      story({ id: "w6", importance: 45, categoryKey: "world" }),
    ];
    const layout = buildEditionLayout(stories, "ru", { maxCoverTeasers: 1 });
    expect(layout!.pages[1]!.articles.length).toBe(3);
    expect(layout!.pages[2]!.articles.length).toBe(2);
    expect(layout!.pages[2]!.articles[0]!.pageOrder).toBe(0);
  });

  it("page numbers and pageOrder are sequential per page", () => {
    const stories = [
      story({ id: "lead", importance: 95, categoryKey: "world" }),
      story({ id: "w1", importance: 60, categoryKey: "world" }),
      story({ id: "t1", importance: 55, categoryKey: "tech" }),
      story({ id: "t2", importance: 54, categoryKey: "tech" }),
    ];
    const layout = buildEditionLayout(stories, "ru", { maxCoverTeasers: 1 });
    const all = layout!.pages.flatMap((p) => p.articles);
    expect(all.map((a) => a.page)).toEqual([1, 1, 2, 2]);
    expect(layout!.pages[1]!.articles[0]!.pageOrder).toBe(0);
    expect(layout!.pages[1]!.articles[1]!.pageOrder).toBe(1);
  });

  it("funny stories land on a trailing light-reading page", () => {
    const s1 = story({ id: "lead", importance: 90, categoryKey: "world" });
    const funny = story({ id: "fun", importance: 20, isFunny: true, categoryKey: "world" });
    const layout = buildEditionLayout([s1, funny], "ru", { maxCoverTeasers: 0 });
    const last = layout!.pages[layout!.pages.length - 1]!;
    expect(last.kind).toBe("light-reading");
    expect(last.section).toBe(LIGHT_READING_SECTION);
    expect(last.articles.map((a) => a.storyId)).toEqual(["fun"]);
  });

  it("omits light-reading page when nothing is funny", () => {
    const layout = buildEditionLayout(
      [story({ id: "a", importance: 90, categoryKey: "world" }), story({ id: "b", importance: 40, categoryKey: "sports" })],
      "ru",
    );
    expect(layout!.pages.some((p) => p.kind === "light-reading")).toBe(false);
  });

  it("marks the most important story as featured", () => {
    const s1 = story({ id: "a", importance: 55, categoryKey: "world" });
    const s2 = story({ id: "b", importance: 90, categoryKey: "world" });
    const layout = buildEditionLayout([s1, s2], "ru");
    const featured = layout!.pages[0]!.articles.find((a) => a.featured);
    expect(featured!.storyId).toBe("b");
  });

  it("routes unknown categories to the briefs section instead of dropping them", () => {
    const s1 = story({ id: "lead", importance: 95, categoryKey: "world" });
    const odd = story({ id: "x", importance: 40, categoryKey: "misc" });
    const layout = buildEditionLayout([s1, odd], "ru", { maxCoverTeasers: 0 });
    const allSections = layout!.pages.map((p) => p.section);
    expect(allSections).toContain("briefs");
    expect(layout!.pages.flatMap((p) => p.articles).map((a) => a.storyId)).toContain("x");
  });
});

describe("editionLabel / kindLabelOf", () => {
  it("labels morning editions in English", () => {
    expect(kindLabelOf("MORNING", "en")).toBe("Morning edition");
    expect(editionLabel("MORNING", new Date("2026-08-12T00:00:00Z"), "en")).toContain("Morning edition");
  });

  it("labels morning editions in Russian", () => {
    expect(kindLabelOf("MORNING", "ru")).toBe("Утренний выпуск");
    expect(editionLabel("MORNING", new Date("2026-08-12T00:00:00Z"), "ru")).toContain("Утренний выпуск");
  });
});
