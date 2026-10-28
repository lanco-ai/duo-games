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
