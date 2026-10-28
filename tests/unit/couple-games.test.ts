import { describe, it, expect, vi } from "vitest";
import {
  Survival,
  SpotDifference,
  CoupleLudo,
  CoupleJump,
} from "../../server/games/couple-puzzles";
import { CoopKitchen, HideSeek } from "../../server/games/couple-action";
import { KnowMe } from "../../server/games/conversation";
import {
  differenceObjects,
  survivalLevels,
} from "../../shared/games/couple-content";
import { defaults, type EngineContext } from "../../shared/games/types";
import * as talk from "../../shared/games/talk-cards/rules";

const ctx = (): EngineContext => ({
  custom: [],
  seen: [],
  pair: 20,
  imageRatio: 1,
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
  emit: vi.fn(),
});
describe("new couple games: authority, scoring and private views", () => {
  it("enforces turns and deterministic dice in flying chess", () => {
    const a = new CoupleLudo("a", { mode: "pure" }, 17, 0, ctx()),
      b = new CoupleLudo("b", { mode: "pure" }, 17, 0, ctx());
    expect(() => a.act(1, "roll", {}, 0)).toThrow();
    a.act(0, "roll", {}, 0);
    b.act(0, "roll", {}, 0);
    expect(a.dice).toBe(b.dice);
    expect(a.positions).toEqual(b.positions);
    if (a.task) a.act(0, "continue", {}, 100);
    expect(a.turn).toBe(1);
    a.positions = [52, -1];
    a.turn = 0;
    a.task = "";
    a.act(0, "roll", {}, 200);
    expect(a.result?.stats.winner).toBe(0);
  });
  it("does not reveal hiding spot or decoys to the seeker", () => {
    const g = new HideSeek("r", { mode: "turn" }, 12, 0, ctx());
    g.act(1, "hide", { id: 8, decoys: [1, 4] }, 5000);
    const seeker = g.view(0),
      hider = g.view(1);
    expect(seeker.ownHide).toBeNull();
    expect(seeker.ownDecoys).toEqual([]);
    expect(hider.ownHide).toBe(8);
    g.act(0, "search", { id: 1 }, 6000);
    expect(g.view(0).hint).toContain("诱饵");
    g.act(0, "search", { id: 8 }, 7000);
    expect(g.result?.stats.winner).toBe(0);
  });
  it("blocks moving under the flashlight and hides keys from the seeker", () => {
    const g = new HideSeek("r", { mode: "realtime" }, 12, 0, ctx());
    expect(g.view(0).furniture.every((item) => item === null)).toBe(true);
    g.act(1, "hide", { id: 7, prop: "🪴" }, 1000);
    expect(g.view(0).keys).toEqual([]);
    expect(
      g
        .view(0)
        .furniture.slice(3)
        .every((item) => item === null),
    ).toBe(true);
    expect(g.view(1).furniture.every((item) => item !== null)).toBe(true);
    g.act(0, "light", { room: 2 }, 1100);
    expect(g.view(0).furniture[7]).toBe("🪴");
    expect(g.view(0).furniture[0]).toBeNull();
    expect(() => g.act(1, "move", { id: 8 }, 1200)).toThrow();
    g.act(0, "light", { room: 0 }, 1300);
    g.act(1, "move", { id: 8 }, 1400);
    expect(() => g.act(0, "search", { id: 8 }, 1500)).toThrow();
  });
  it("reveals timed blind answers only at the deadline and handles missing answers", () => {
    const g = new KnowMe(
      "r",
      { ...defaults["know-me"], mode: "blind", unused: false },
      2,
      1000,
      ctx(),
    );
    g.act(0, "submit", { idx: 0, answer: 1 }, 2000);
    g.act(1, "submit", { idx: 0, answer: 1 }, 2200);
    expect(g.view(0, 5999).answers).toBeNull();
    expect(g.tick(5999)).toBe(false);
    g.tick(6000);
    expect(g.view(0, 6000).answers).toEqual([1, 1]);
    expect(g.points).toBe(10);
    g.act(0, "next", { idx: 0 }, 7000);
    g.act(0, "submit", { idx: 1, answer: 0 }, 8000);
    g.tick(12000);
    expect(g.history[1].score).toBe(0);
  });
  it("keeps classic chat and adds separate pro pools with a dare resolution", () => {
    let s = talk.init({ decks: ["轻松"], limit: 10, talkMode: "pro" }, 3, []);
    s = talk.apply(
      s,
      0,
      { type: "pro-draw", trigger: "dice", pool: "dare" },
      1000,
    ).s;
    expect(talk.view(s).card?.deck).toBe("小挑战");
    expect(s.pro?.deadline).toBe(61600);
    expect(
      talk.apply(s, 0, { type: "pro-resolve", outcome: "complete" }, 61600)
        .error,
    ).toBe("INVALID");
    expect(talk.apply(s, 0, { type: "next", idx: 0 }, 1700).error).toBe(
      "INVALID",
    );
    expect(
      talk.apply(s, 1, { type: "pro-resolve", outcome: "coupon" }, 1700).error,
    ).toBe("INVALID");
    s = talk.apply(s, 0, { type: "pro-resolve", outcome: "coupon" }, 1700).s;
    expect(s.pro?.penalties).toEqual([1, 0]);
    s = talk.apply(s, 1, { type: "next", idx: 0 }, 1800).s;
    s = talk.apply(
      s,
      1,
      { type: "pro-draw", trigger: "wheel", pool: "truth" },
      2000,
    ).s;
    expect(talk.view(s).card?.deck).not.toBe("小挑战");
  });
});
