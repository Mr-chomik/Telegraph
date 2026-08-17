import { describe, expect, it } from "vitest";
import { plausibleAgainstSources } from "../../ai/types";
import { NoAIProvider } from "../../ai/noai";
import { selectFormat, sectionForCategory } from "../../editorial/format";

describe("plausibleAgainstSources", () => {
  const sources = [
    "Запуск нового исследовательского спутника прошёл успешно.",
    "Трансляция продолжится в прямом эфире, подробности позже.",
  ];

  it("accepts text grounded in sources", () => {
    expect(plausibleAgainstSources("Запуск спутника прошёл успешно.", sources)).toBe(true);
  });

  it("rejects fabricated claims with unknown specifics", () => {
    expect(plausibleAgainstSources("Президент Непала объявил войну Юпитеру.", sources)).toBe(false);
  });
});

describe("NoAIProvider", () => {
  it("is never available and never refines", async () => {
    const p = new NoAIProvider();
    expect(await p.isAvailable()).toBe(false);
    expect(await p.refine({ language: "ru", sources: ["a"], draftHeadline: "h", draftSummary: "s" })).toBeNull();
  });
});

describe("format selection", () => {
  it("maps editorial signals to article formats", () => {
    expect(selectFormat({ importance: 90, urgent: true, isFunny: false, hasMedia: true, textLength: 500 })).toBe("URGENT");
    expect(selectFormat({ importance: 90, urgent: false, isFunny: false, hasMedia: false, textLength: 300 })).toBe("MAJOR");
    expect(selectFormat({ importance: 70, urgent: false, isFunny: false, hasMedia: false, textLength: 200 })).toBe("STANDARD");
    expect(selectFormat({ importance: 50, urgent: false, isFunny: false, hasMedia: false, textLength: 100 })).toBe("BRIEF");
    expect(selectFormat({ importance: 10, urgent: false, isFunny: true, hasMedia: false, textLength: 80 })).toBe("FUNNY");
  });

  it("routes light reading and categories to newspaper sections", () => {
    expect(sectionForCategory("humor", true)).toBe("light-reading");
    expect(sectionForCategory("main", false)).toBe("front-page");
    expect(sectionForCategory("tech", false)).toBe("technology");
    expect(sectionForCategory("sports", false)).toBe("sports");
    expect(sectionForCategory("something-else", false)).toBe("briefs");
  });
});