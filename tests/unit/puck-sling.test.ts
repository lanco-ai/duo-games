import { describe, it, expect, vi } from "vitest";
import { PuckSling } from "../../server/games/puck-sling";
import * as sling from "../../shared/games/puck-sling/sim";
import type { EngineContext } from "../../shared/games/types";
function ctx(): EngineContext {
  return {
    custom: [],
    seen: [],
    pair: 0,
    imageRatio: 1.5,
    gallery: vi.fn(),
    seenQuestion: vi.fn(),
    emit: vi.fn(),
  };
}
const ms = (tick: number) => Math.ceil(tick / 0.06);
/** Pull that sends puck `id` straight at the middle of the gap. */
function aim(s: sling.State, id: number, seat: 0 | 1, power = 90) {
  const q = s.pucks[id],
    tx = ((sling.GAP_LEFT + sling.GAP_RIGHT) / 2) * sling.Q - q.x,
    ty = sling.MID * sling.Q - q.y,
    l = Math.hypot(tx, ty);
  return sling.clampPull(seat, -(tx / l) * power, -(ty / l) * power)!;
}
describe("puck-sling", () => {
  it("starts with five pucks on each half, all at rest", () => {
    const s = sling.initial();
    expect(sling.counts(s)).toEqual([5, 5]);
    expect(sling.moving(s)).toBe(false);
    s.pucks.forEach((q, i) =>
      expect(sling.grabbable(q, i < 5 ? 0 : 1)).toBe(true),
    );
  });
  it("only accepts pulls back towards the shooter's own baseline", () => {
    expect(sling.validPull(0, 0, 60)).toBe(true);
    expect(sling.validPull(0, 0, -60)).toBe(false);
    expect(sling.validPull(1, 0, -60)).toBe(true);
    expect(sling.validPull(0, 0, 5)).toBe(false);
    expect(sling.validPull(0, 0, 101)).toBe(false);
    expect(sling.validPull(0, 0.5, 60)).toBe(false);
  });
  it("is deterministic and a well-aimed shot crosses through the gap", () => {
    const shot: sling.Shot = {
      tick: 0,
      seat: 0,
      id: 2,
      ...aim(sling.initial(), 2, 0),
    };
    const a = sling.advance(sling.initial(), [shot], 400),
      b = sling.advance(sling.initial(), [shot], 400);
    expect(a).toEqual(b);
    expect(sling.counts(a)).toEqual([4, 6]);
    expect(sling.moving(a)).toBe(false);
  });
  it("the wall stops a shot aimed away from the gap", () => {
    const s = sling.advance(
      sling.initial(),
      [{ tick: 0, seat: 0, id: 0, dx: 0, dy: 100 }],
      400,
    );
    expect(sling.sideOf(s.pucks[0])).toBe(0);
  });
  it("engine validates shots, settles them and declares the player who cleared their half", () => {
    const g = new PuckSling("r", { minutes: 3 }, 1, 0, ctx());
    expect(() =>
      g.act(0, "shot", { epoch: 0, tick: 0, id: 7, dx: 0, dy: 60 }, 0),
    ).toThrow("STALE");
    expect(() =>
      g.act(0, "shot", { epoch: 0, tick: 0, id: 0, dx: 0, dy: -60 }, 0),
    ).toThrow("INVALID");
    expect(() =>
      g.act(0, "shot", { epoch: 1, tick: 0, id: 0, dx: 0, dy: 60 }, 0),
    ).toThrow("STALE");
    let tick = 0;
    for (let round = 0; round < 40 && !g.result; round++) {
      const s = sling.advance(g.base, g.shots, tick);
      // Shoot the free puck nearest the gap, as a player would.
      const gap = (q: sling.Puck) =>
        Math.hypot(q.x - 180 * sling.Q, q.y - sling.MID * sling.Q);
      const id = s.pucks
        .map((_, i) => i)
        .filter((i) => sling.grabbable(s.pucks[i], 0) && aim(s, i, 0))
        .sort((a, b) => gap(s.pucks[a]) - gap(s.pucks[b]))[0];
      if (id !== undefined)
        g.act(0, "shot", { epoch: 0, tick, id, ...aim(s, id, 0) }, ms(tick));
      tick += 240;
      g.tick(ms(tick));
    }
    for (let i = 0; i < 5 && !g.result; i++) g.tick(ms((tick += 60)));
    expect(g.result?.primary.value).toBe("玩家 1 获胜");
    expect(g.result?.stats.player0).toBe(0);
  });
  it("time-up compares what is left and enforces the cooldown", () => {
    const g = new PuckSling("r", { minutes: 2 }, 1, 0, ctx());
    const s = g.base;
    g.act(1, "shot", { epoch: 0, tick: 0, id: 7, ...aim(s, 7, 1) }, 0);
    expect(() =>
      g.act(1, "shot", { epoch: 0, tick: 0, id: 6, ...aim(s, 6, 1) }, 0),
    ).toThrow("STALE");
    g.tick(ms(2 * 60 * 60 + 61));
    expect(g.result?.primary.value).toBe("玩家 2 获胜");
    expect(g.result?.highlights[0]).toBe("剩余冰球 6 : 4");
  });
  it("freezes while paused and rejects old-epoch shots after resuming", () => {
    const g = new PuckSling("r", { minutes: 3 }, 1, 0, ctx());
    g.pause(ms(100));
    expect(g.time(ms(5000))).toBe(g.pausedTick);
    g.shift(ms(5000) - ms(100));
    g.resume();
    expect(() =>
      g.act(0, "shot", { epoch: 0, tick: 100, id: 0, dx: 0, dy: 60 }, ms(5000)),
    ).toThrow("STALE");
    expect(
      g.act(
        0,
        "shot",
        { epoch: 1, tick: g.time(ms(5000)), id: 0, dx: 0, dy: 60 },
        ms(5000),
      ),
    ).toBe(true);
  });
});
