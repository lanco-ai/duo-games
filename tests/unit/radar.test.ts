import { it, expect, vi } from "vitest";
import { radarStats } from "../../shared/games/radar";
import { MindMeld } from "../../server/games/conversation";
it("aggregates tagged answers without inventing uncovered axes or custom categories", () => {
  const s = radarStats([
    { tag: "吃喝", points: 10, max: 10 },
    { tag: "饮食", points: 0, max: 10 },
    { tag: "我们的题", points: 10, max: 10 },
    { tag: "恋爱观", points: 5, max: 10 },
  ]);
  expect(s.radar_food).toBe(50);
  expect(s.radar_food_count).toBe(2);
  expect(s.radar_personality).toBe(50);
  expect(s.radar_future_count).toBe(0);
  expect(s).not.toHaveProperty("radar_future");
});
it("uses an explicit MindMeld topic and only revealed matches, including mutual agreement", () => {
  const ctx = {
    custom: [],
    seen: [],
    pair: 0,
    imageRatio: 1,
    emit: vi.fn(),
    gallery: vi.fn(),
    seenQuestion: vi.fn(),
  };
  const g = new MindMeld("r", { seconds: 0, topic: "回忆" }, 1, 100, ctx);
  g.history = [
    ["公园", "河边"],
    ["散步", "散心"],
  ];
  g.complete(true);
  expect(g.result?.stats.radar_memories).toBe(50);
  expect(g.result?.stats.radar_memories_count).toBe(2);
  const free = new MindMeld("r", { seconds: 0 }, 1, 100, ctx);
  free.history = [["茶", "茶"]];
  free.complete(true);
  expect(free.result?.stats).not.toHaveProperty("radar_food");
});
