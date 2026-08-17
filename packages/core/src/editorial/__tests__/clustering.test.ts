import { describe, expect, it } from "vitest";
import { clusterPosts, clusterHashOf } from "../../editorial/cluster";

interface DemoItem {
  id: string;
  text: string;
  normalizedText: string;
  publishedAt: Date;
}

function item(id: string, text: string, minutesAgo: number): DemoItem {
  return {
    id,
    text,
    normalizedText: text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(),
    publishedAt: new Date(Date.now() - minutesAgo * 60_000),
  };
}

const MAJOR_EVENT = "Запуск нового исследовательского спутника прошёл успешно. Правительство готовит план. Трансляция продолжится в прямом эфире.";

describe("clusterPosts", () => {
  it("binds identical copy-paste across channels into one cluster", () => {
    const posts = [
      item("a", MAJOR_EVENT, 90),
      item("b", MAJOR_EVENT, 90),
      item("c", MAJOR_EVENT, 90),
    ];
    const clusters = clusterPosts(posts);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.members).toHaveLength(3);
    expect(clusters[0]!.representative.id).toBe("a");
  });

  it("keeps unrelated posts as separate stories", () => {
    const posts = [
      item("a", "Обзор нового смартфона: камера и батарея тест.", 150),
      item("b", "Кот забрался в офис и отредактировал статью.", 40),
      item("c", "Курс рубля и итоги торгов на неделе.", 100),
    ];
    const clusters = clusterPosts(posts);
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.members.length === 1)).toBe(true);
  });

  it("merges lightly reworded versions of the same event", () => {
    const posts = [
      item("a", MAJOR_EVENT, 90),
      item(
        "b",
        "Запуск нового исследовательского спутника прошёл успешно. Правительство готовит детальный план. Трансляция продолжится в прямом эфире, подробности позже.",
        80,
      ),
    ];
    const clusters = clusterPosts(posts);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.members.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("produces a stable cluster hash per representative", () => {
    expect(clusterHashOf("post-1")).toMatch(/^[0-9a-f]{64}$/);
    expect(clusterHashOf("post-1")).toBe(clusterHashOf("post-1"));
    expect(clusterHashOf("post-1")).not.toBe(clusterHashOf("post-2"));
  });
});