import { describe, it, expect, vi } from "vitest";
import { Survival } from "../../server/games/survival";
import { survivalQuestions } from "../../shared/content/survival";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: ["level:survival:5"],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
});
const make = () => new Survival("r", { chapter: "1" }, 17, 1000, ctx());
describe("P3 private subjective answers", () => {
  it("contains seventy-five unique prompts in five chapters and real labeled objects", () => {
    expect(survivalQuestions).toHaveLength(75);
    expect(new Set(survivalQuestions.map((q) => q.prompt)).size).toBe(75);
    for (let chapter = 0; chapter < 5; chapter++)
      expect(
        survivalQuestions.filter((q) => q.chapter === chapter),
      ).toHaveLength(15);
    for (const q of survivalQuestions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.objects.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("never sends the asker secret, even in custom text, to the other seat before reveal", () => {
    const g = make();
    g.act(0, "submit", { idx: 0, text: "我想收到一片枫叶" }, 1100);
    expect(JSON.stringify(g.view(1))).not.toContain("枫叶");
    expect(g.view(0).own).toContain("枫叶");
    expect(g.view(1).answers).toBeNull();
    g.act(1, "submit", { idx: 0, choice: 0 }, 1200);
    expect(g.view(1).answers?.[0]).toContain("枫叶");
    expect(() => g.act(1, "rate", { idx: 0, value: 1 }, 1300)).toThrow();
    g.act(0, "rate", { idx: 0, value: 0 }, 1300);
    expect(g.phase).toBe("reveal");
  });
  it("alternates roles, records five answers, produces a keepsake and unlocks the next chapter", () => {
    const g = make();
    for (let idx = 0; idx < 5; idx++) {
      g.act(0, "submit", { idx, choice: 1 }, 2000 + idx * 1000);
      g.act(1, "submit", { idx, choice: 1 }, 2100 + idx * 1000);
      g.act(0, "next", { idx }, 2200 + idx * 1000);
    }
    expect(g.result?.stats.stars).toBe(3);
    expect(g.history).toHaveLength(5);
    expect(g.ctx.gallery).toHaveBeenCalledWith(
      "survival",
      expect.any(String),
      expect.objectContaining({ lines: expect.any(Array) }),
    );
  });
  it("shifts question and rating deadlines, and reveals missing submissions only at timeout", () => {
    const g = make();
    g.act(0, "submit", { idx: 0, choice: 1 }, 1100);
    g.shift(10000);
    expect(g.tick(50999)).toBe(false);
    expect(g.view(1).answers).toBeNull();
    g.tick(51000);
    expect(g.phase).toBe("rate");
    expect(g.tick(66000)).toBe(true);
    expect(g.phase).toBe("reveal");
  });
  it("lets only the answering partner request a single resurrection and asker confirm", () => {
    const g = make();
    for (let idx = 0; idx < 3; idx++) {
      g.act(0, "submit", { idx, choice: 0 }, 2000 + idx * 1000);
      g.act(1, "submit", { idx, choice: 1 }, 2100 + idx * 1000);
      g.act(g.asker, "rate", { idx, value: -1 }, 2200 + idx * 1000);
      if (idx < 2) g.act(0, "next", { idx }, 2300 + idx * 1000);
    }
    expect(g.phase).toBe("revive");
    expect(() =>
      g.act(g.asker, "appeal", { idx: 2, text: "再给我一次机会" }, 6000),
    ).toThrow();
    g.act(1, "appeal", { idx: 2, text: "再给我一次机会" }, 6000);
    g.act(0, "revive", { idx: 2, accept: true }, 6100);
    expect(g.revived).toBe(true);
    expect(g.lives).toBe(1);
  });
});
