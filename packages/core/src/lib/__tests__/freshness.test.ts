import { describe, expect, it } from "vitest";
import { editionIntervalHours, fetchFreshnessHours } from "../freshness";

describe("editionIntervalHours", () => {
  it("uses the largest gap including the overnight wrap", () => {
    expect(editionIntervalHours(["08:00", "13:00", "19:00"])).toBe(13);
  });

  it("handles a single slot as a full day", () => {
    expect(editionIntervalHours(["08:00"])).toBe(24);
  });

  it("is unsorted-tolerant", () => {
    expect(editionIntervalHours(["19:00", "08:00", "13:00"])).toBe(13);
  });

  it("returns 24h when no slots are configured", () => {
    expect(editionIntervalHours([])).toBe(24);
  });

  it("computes small gaps correctly", () => {
    expect(editionIntervalHours(["06:00", "12:00", "18:00", "00:00"])).toBe(6);
  });
});

describe("fetchFreshnessHours", () => {
  it("uses 24h on first run", () => {
    expect(fetchFreshnessHours({ firstRun: true, editionTimes: ["08:00", "13:00", "19:00"] })).toBe(24);
  });

  it("uses the edition interval afterwards", () => {
    expect(fetchFreshnessHours({ firstRun: false, editionTimes: ["08:00", "13:00", "19:00"] })).toBe(13);
  });
});
