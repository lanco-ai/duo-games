import { describe, it, expect, vi } from "vitest";
import { CoupleLudo } from "../../server/games/ludo";
import { ludoContent } from "../../shared/content/ludo";
import { ludoBoard } from "../../shared/games/couple-ludo/board";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: [],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
  journal: vi.fn(),
});
const make = (victory = "coop") =>
  new CoupleLudo("r", { mode: "pure", victory }, 9, 1000, ctx());
describe("P5 cooperative decision board", () => {
  it("has thirty-six explicit cells and each zone/intensity has twenty truths and ten challenges", () => {
    expect(ludoBoard).toHaveLength(36);
    for (let zone = 0; zone < 5; zone++)
      for (const mode of ["pure", "warm", "fun"]) {
        const pool = ludoContent.filter(
          (t) => t.zone === zone && t.mode === mode,
        );
        expect(pool.filter((t) => t.kind === "truth")).toHaveLength(20);
        expect(pool.filter((t) => t.kind !== "truth")).toHaveLength(10);
      }
    expect(new Set(ludoContent.map((t) => t.id)).size).toBe(450);
  });
  it("rolls reproducible dice, requires a choice, and moves by the chosen die on the first turn", () => {
    const a = make(),
      b = make();
    a.act(0, "roll", {}, 1000);
    b.act(0, "roll", {}, 1000);
    expect(a.dice).toEqual(b.dice);
    expect(a.positions).toEqual([0, 0]);
    expect(() => a.act(1, "choose", { index: 0 }, 1100)).toThrow();
    const n = a.dice[0];
    a.act(0, "choose", { index: 0 }, 1200);
    expect(a.positions[0]).toBe(n);
  });
  it("gifts both dice, uses the bank only on the recipient next move and saves memories in the journal", () => {
    const g = make();
    g.act(0, "roll", {}, 1000);
    const sum = g.dice[0] + g.dice[1];
    g.act(0, "gift", {}, 1100);
    expect(g.turn).toBe(1);
    expect(g.bank[1]).toBe(sum);
    g.positions = [3, 3];
    g.turn = 0;
    g.phase = "memory";
    g.act(0, "memory", { text: "第一次一起散步" }, 1200);
    expect(g.ctx.journal).toHaveBeenCalledWith(
      expect.any(String),
      "第一次一起散步",
      0,
    );
  });
  it("requires both finish in cooperation and applies partner ratings without revealing secret words", () => {
    const g = make();
    g.positions = [35, 20];
    expect(g.checkFinish()).toBe(false);
    g.positions = [35, 35];
    expect(g.checkFinish()).toBe(true);
    expect(g.result?.stats.winner).toBe(-1);
    const versus = make("versus");
    versus.positions = [35, 0];
    expect(versus.checkFinish()).toBe(true);
    const word = make();
    word.phase = "challenge";
    word.task = {
      id: "w",
      kind: "word",
      text: "默契词",
      zone: 0,
      mode: "pure",
    };
    word.act(0, "word", { text: "秘密玫瑰" }, 1000);
    expect(JSON.stringify(word.view(1))).not.toContain("秘密玫瑰");
    word.act(1, "word", { text: "秘密玫瑰" }, 1100);
    expect(word.lastWords).toEqual(["秘密玫瑰", "秘密玫瑰"]);
  });
  it("does not repeat a task, shares only the drawn task and needs two challenge confirmations", () => {
    const g = make();
    g.positions[0] = 1;
    for (let i = 0; i < 20; i++) {
      g.arrive();
      expect(g.task).not.toBeNull();
      g.endTurn();
      g.turn = 0;
    }
    expect(g.used.size).toBe(20);
    g.arrive();
    expect(g.task).toBeNull();
    expect(g.view(0)).not.toHaveProperty("seed");
    g.phase = "challenge";
    g.task = {
      id: "c",
      kind: "challenge",
      text: "一起击掌",
      zone: 0,
      mode: "pure",
    };
    g.act(0, "confirm", {}, 1000);
    expect(g.phase).toBe("challenge");
    g.act(1, "confirm", {}, 1001);
    expect(g.phase).toBe("roll");
  });
});
