import { it, expect, vi } from "vitest";
import { HeartBounce } from "../../server/games/action";
import * as sim from "../../shared/games/heart-bounce/sim";
const make = () =>
  new HeartBounce("r", {}, 7, 0, {
    custom: [],
    seen: [],
    pair: 0,
    imageRatio: 1,
    emit: vi.fn(),
    gallery: vi.fn(),
    seenQuestion: vi.fn(),
  });
it("spawns deterministic stars every fifteen genuine alternate hits and scores combo thresholds", () => {
  const g = make();
  for (let i = 0; i < 15; i++) {
    const tick = sim.paddleTick(g.hit),
      x = sim.ballAt(g.hit, tick).x / 256;
    g.act(
      g.owner,
      "hit",
      { epoch: g.epoch, n: g.hit.n, tick, x },
      (tick / 60) * 1000,
    );
  }
  expect(g.star).not.toBeNull();
  expect(g.best).toBe(15);
  for (let i = 0; i < 3; i++) g.miss(g.time(g.startAt + 100000));
  expect(g.result?.stats.stars).toBe(1);
});
it("collects a swept star, widens collision by ten seconds and preserves buff duration through pause", () => {
  const g = make(),
    tick = g.hit.tick + 10,
    p = sim.ballAt(g.hit, tick);
  g.star = { x: p.x / 256, y: p.y / 256 };
  g.starTick = tick;
  expect(g.collectStar((tick / 60) * 1000)).toBe(true);
  expect(g.star).toBeNull();
  const until = g.wideUntil;
  expect(g.paddleWidth(until - 1)).toBeGreaterThan(sim.PADDLE_WIDTH);
  g.shift(5000);
  expect(g.wideUntil).toBe(until + 5000);
  expect(g.paddleWidth(until + 5000)).toBe(sim.PADDLE_WIDTH);
  const crossing = sim.paddleTick(g.hit);
  expect(sim.canHit(g.hit, crossing, 240)).toBe(false);
  expect(sim.canHit(g.hit, crossing, 240, 122)).toBe(true);
});
