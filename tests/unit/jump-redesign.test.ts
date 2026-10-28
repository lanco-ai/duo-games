import { describe, it, expect, vi } from "vitest";
import { CoupleJump } from "../../server/games/jump";
import { type EngineContext } from "../../shared/games/types";
import { platformX } from "../../shared/games/couple-jump/levels";
const ctx = (): EngineContext => ({
  custom: [],
  seen: ["level:couple-jump:5"],
  pair: 20,
  imageRatio: 1,
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
  emit: vi.fn(),
});
const make = (mode = "sync", level = "1", at = 1000) =>
  new CoupleJump("r", { mode, level }, 13, at, ctx());
describe("P1 server-authoritative platform journeys", () => {
  it("simultaneous zero charge must fall and client heldMs cannot rescue it", () => {
    const g = make();
    g.act(0, "press", { n: 1 }, 1000);
    g.act(1, "press", { n: 1 }, 1000);
    g.act(0, "release", { n: 1, heldMs: 900 }, 1000);
    g.act(1, "release", { n: 1, heldMs: 900 }, 1000);
    expect(g.last.landed).toBe(false);
    expect(g.lives).toBe(2);
    expect(g.points).toBe(0);
    expect(g.step).toBe(0);
  });
  it("requires each distinct target and actual release synchronization", () => {
    const g = make();
    g.platforms.forEach((p, i) => {
      p.x = 200 + i * 40;
      p.amplitude = 0;
    });
    g.act(0, "press", {}, 1000);
    g.act(1, "press", {}, 1000);
    g.act(0, "release", {}, 1800);
    g.act(1, "release", {}, 1960);
    expect(g.last.perfect).toBe(true);
    expect(g.points).toBe(4);
    const bad = make();
    bad.platforms[0].x = 200;
    bad.platforms[1].x = 400;
    bad.act(0, "press", {}, 1000);
    bad.act(1, "press", {}, 1000);
    bad.act(0, "release", {}, 1800);
    bad.act(1, "release", {}, 1800);
    expect(bad.last.landed).toBe(false);
  });
  it("replays a seed, shifts active charges, ice and moving platform phase", () => {
    const a = make("relay", "3"),
      b = make("relay", "3");
    expect(a.view(0, 2000)).toEqual(b.view(0, 2000));
    a.act(0, "press", {}, 1200);
    const before = a.view(0, 1500);
    a.shift(5000);
    expect(a.view(0, 6500).platforms).toEqual(before.platforms);
    expect(a.started[0]).toBe(6200);
    const ice = make("relay", "2");
    ice.shift(5000);
    expect(ice.tick(7999)).toBe(false);
    expect(ice.tick(8000)).toBe(true);
    expect(ice.lives).toBe(2);
  });
  it("finishes a level with stars and a gallery keepsake after ten legal jumps", () => {
    const g = make("relay");
    let now = 1000;
    for (let i = 0; i < 10; i++) {
      const seat = (i % 2) as 0 | 1;
      g.act(seat, "press", {}, now);
      now += platformX(g.platforms[0], 0) * 4;
      g.act(seat, "release", {}, now);
      now += 200;
    }
    expect(g.result?.stats.stars).toBe(3);
    expect(g.result?.stats.steps).toBe(10);
    expect(g.ctx.gallery).toHaveBeenCalledOnce();
    expect(JSON.stringify(g.view())).not.toContain("target");
  });
  it("rejects repeated input sequence and times out an unpaired release", () => {
    const g = make();
    g.act(0, "press", { n: 7 }, 1000);
    g.act(0, "release", { n: 7 }, 1800);
    expect(g.tick(2101)).toBe(true);
    expect(() => g.act(0, "press", { n: 7 }, 2200)).toThrow();
  });
});
