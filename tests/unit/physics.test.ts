import { describe, expect, it } from "vitest";
import { isqrt, Q, mul } from "../../shared/fixed";
import {
  createLevel,
  levelFromTiles,
  tileAt,
  type Level,
} from "../../shared/games/red-thread/levels";
import {
  init,
  step,
  read,
  hash,
  STATE,
  P,
  playerIndex,
  JUMP_KEY,
  GRAB,
  RIGHT,
  LEFT,
} from "../../shared/games/red-thread/sim";
import * as bounce from "../../shared/games/heart-bounce/sim";
function fixture(
  changes: [number, number, string][] = [],
  options: Partial<Level> = {},
) {
  const rows = Array.from({ length: 24 }, () => Array<string>(20).fill("."));
  for (let y = 0; y < 24; y++) {
    rows[y][0] = "#";
    rows[y][19] = "#";
  }
  rows[22].fill("#");
  for (const [x, y, value] of changes) rows[y][x] = value;
  return levelFromTiles(
    rows.map((row) => row.join("")),
    {
      spawn: [
        { x: 80, y: 345 },
        { x: 112, y: 345 },
      ],
      ...options,
    },
  );
}
function setPlayer(s: Int32Array, seat: number, x: number, y: number) {
  s[playerIndex(seat, P.X)] = x * Q;
  s[playerIndex(seat, P.Y)] = y * Q;
  s[playerIndex(seat, P.VX)] = 0;
  s[playerIndex(seat, P.VY)] = 0;
}
describe("deterministic Q8 platform simulation", () => {
  it("uses corrected integer roots and never truncates a large Q8 product", () => {
    for (const n of [
      0,
      1,
      2,
      255,
      256,
      257,
      1_000_000_000_003,
      Number.MAX_SAFE_INTEGER,
    ]) {
      const root = isqrt(n);
      expect(root * root).toBeLessThanOrEqual(n);
      expect((root + 1) * (root + 1)).toBeGreaterThan(n);
    }
    expect(mul(100000, 100000)).toBe(39062500);
  });
  it("runs 100000 seeded frames with equal hashes, finite integer state and bounded players", () => {
    const level = createLevel("3", 81023),
      a = init(level),
      b = init(level);
    let rng = 81023;
    for (let tick = 0; tick < 100000; tick++) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const inputs: [number, number] = [(rng >>> 20) & 31, (rng >>> 12) & 31];
      step(a, inputs, level);
      step(b, inputs, level);
      if (hash(a) !== hash(b)) throw new Error("Determinism failed at " + tick);
      for (const player of read(a).players) {
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y))
          throw new Error("Nonfinite player");
        if (
          Math.abs(player.x) > level.width * 16 ||
          Math.abs(player.y) > 100000
        )
          throw new Error("Escaped level bounds");
      }
    }
    expect(hash(a)).toBe(hash(b));
  }, 30000);
  it("lands, jumps with variable height, and never moves into solid walls", () => {
    const level = fixture(),
      short = init(level),
      high = init(level);
    step(short, [JUMP_KEY, 0], level);
    step(high, [JUMP_KEY, 0], level);
    let shortTop = read(short).players[0].y,
      highTop = read(high).players[0].y;
    for (let i = 0; i < 35; i++) {
      step(short, [0, 0], level);
      step(high, [JUMP_KEY, 0], level);
      shortTop = Math.min(shortTop, read(short).players[0].y);
      highTop = Math.min(highTop, read(high).players[0].y);
    }
    expect(highTop).toBeLessThan(shortTop - 10);
    for (let i = 0; i < 200; i++) step(high, [RIGHT, RIGHT], level);
    expect(read(high).players.every((p) => p.x <= 299 && p.y <= 345)).toBe(
      true,
    );
  });
  it("holds a falling partner, counts a rescue once and permits climbing", () => {
    const level = fixture([], { stamina: true }),
      state = init(level);
    setPlayer(state, 0, 21, 100);
    setPlayer(state, 1, 50, 180);
    for (let tick = 0; tick < 80; tick++) step(state, [GRAB, 0], level);
    const held = read(state);
    expect(held.players[0].grabbing).toBe(true);
    expect(held.players[0].y).toBe(100);
    expect(held.rescues).toBe(1);
    const dx = held.players[0].x - held.players[1].x,
      dy = held.players[0].y - held.players[1].y;
    expect(dx * dx + dy * dy).toBeLessThanOrEqual(89 * 89);
    for (let tick = 0; tick < 24; tick++) step(state, [GRAB, JUMP_KEY], level);
    expect(read(state).players[1].y).toBeLessThan(held.players[1].y - 8);
  });
  it("climbs at bounded speed without accumulating sideways acceleration", () => {
    const level = createLevel("1"),
      state = init(level);
    for (let t = 0; t < 40; t++) step(state, [LEFT, LEFT], level);
    for (let t = 0; t < 40; t++) step(state, [GRAB, RIGHT], level);
    let climbingTicks = 0;
    for (let t = 0; t < 25; t++) {
      step(state, [GRAB, JUMP_KEY], level);
      const p = read(state).players[1];
      if (p.hanging) {
        climbingTicks++;
        expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(1.01);
      }
    }
    expect(climbingTicks).toBeGreaterThanOrEqual(8);
  });
  it("does not count two independent wall grips as mutual rescues", () => {
    const level = fixture([], {
      stamina: true,
      spawn: [
        { x: 21, y: 100 },
        { x: 21, y: 188 },
      ],
    });
    const state = init(level);
    for (let t = 0; t < 60; t++) step(state, [GRAB, GRAB], level);
    const v = read(state);
    expect(v.players.map((p) => [p.x, p.y])).toEqual([
      [21, 100],
      [21, 188],
    ]);
    expect(v.players.every((p) => p.grabbing && !p.hanging)).toBe(true);
    expect(v.rescues).toBe(0);
  });
  it("exhausts grip after four seconds and requires releasing before regripping", () => {
    const level = fixture([], { stamina: true }),
      state = init(level);
    for (let tick = 0; tick < 240; tick++) step(state, [GRAB, GRAB], level);
    expect(read(state).players[0].grabbing).toBe(false);
    step(state, [GRAB, GRAB], level);
    expect(read(state).players[0].grabbing).toBe(false);
    step(state, [0, 0], level);
    step(state, [GRAB, GRAB], level);
    expect(read(state).players[0].grabbing).toBe(true);
  });
  it("uses one-way platforms from above, while permitting upward passage", () => {
    const level = fixture([
        [4, 19, "="],
        [5, 19, "="],
        [6, 19, "="],
      ]),
      state = init(level);
    setPlayer(state, 0, 80, 325);
    setPlayer(state, 1, 112, 345);
    state[playerIndex(0, P.VY)] = -6 * Q;
    let top = 325;
    for (let i = 0; i < 60; i++) {
      step(state, [0, 0], level);
      top = Math.min(top, read(state).players[0].y);
    }
    expect(top).toBeLessThan(297);
    expect(read(state).players[0].y).toBe(297);
  });
  it("breaks crumbling surfaces after 30 ticks and restores them 180 ticks later", () => {
    const level = fixture([
        [4, 22, "C"],
        [5, 22, "C"],
        [6, 22, "C"],
        [7, 22, "C"],
      ]),
      state = init(level);
    for (let i = 0; i < 32; i++) step(state, [0, 0], level);
    expect(read(state).players[0].y).toBeGreaterThan(345);
    for (let i = 0; i < 181; i++) step(state, [0, 0], level);
    // Respawn after both fall below the checkpoint, onto the restored platform.
    for (let i = 0; i < 80; i++) step(state, [0, 0], level);
    expect(read(state).deaths).toBeGreaterThan(0);
  });
  it("activates a checkpoint and respawns both after a spike without erasing hearts", () => {
    const level = fixture([
        [5, 18, "F"],
        [6, 18, "H"],
        [9, 18, "^"],
      ]),
      state = init(level);
    setPlayer(state, 0, 88, 296);
    setPlayer(state, 1, 104, 296);
    step(state, [0, 0], level);
    expect(read(state).hearts).toBe(1);
    expect(read(state).checkpoint.y).toBe(296);
    setPlayer(state, 0, 152, 296);
    step(state, [0, 0], level);
    expect(read(state).deathDelay).toBe(40);
    for (let i = 0; i < 40; i++) step(state, [0, 0], level);
    expect(read(state).players.map((p) => p.x)).toEqual([72, 104]);
    expect(read(state).hearts).toBe(1);
  });
  it("opens a latched gate only when both separate pressure plates are occupied", () => {
    const level = fixture([
        [5, 22, "P"],
        [7, 22, "P"],
        [8, 20, "D"],
      ]),
      state = init(level);
    setPlayer(state, 0, 88, 345);
    setPlayer(state, 1, 120, 345);
    step(state, [0, 0], level);
    expect(read(state).doorsOpen).toBe(true);
    step(state, [JUMP_KEY, JUMP_KEY], level);
    expect(read(state).doorsOpen).toBe(true);
    const other = init(level);
    setPlayer(other, 0, 88, 345);
    setPlayer(other, 1, 86, 345);
    step(other, [0, 0], level);
    expect(read(other).doorsOpen).toBe(false);
  });
  it("requires thirty grounded ticks from both characters on the bridge", () => {
    const level = fixture([
        [4, 22, "G"],
        [5, 22, "G"],
        [6, 22, "G"],
        [7, 22, "G"],
      ]),
      state = init(level);
    for (let i = 0; i < 29; i++) step(state, [0, 0], level);
    expect(read(state).won).toBe(false);
    step(state, [0, 0], level);
    expect(read(state).won).toBe(true);
  });
  it("has distinct full-size levels and seed-dependent endless chunks above the preview", () => {
    const courses = [1, 2, 3, 4].map((n) => createLevel(String(n), 7));
    expect(
      courses.every(
        (l) => l.height >= 150 && l.width === 20 && l.goals.length > 1,
      ),
    ).toBe(true);
    expect(courses[1].moving.length).toBeGreaterThan(0);
    expect(courses[2].tiles.join("")).toMatch(/S/);
    expect(courses[2].crumbles.length).toBeGreaterThan(0);
    expect(courses[3].tiles.join("")).toMatch(/P.*P/);
    const endless = createLevel("endless", 20);
    expect(
      Array.from({ length: 100 }, (_, row) =>
        Array.from({ length: 20 }, (_, x) => tileAt(endless, x, -row - 1)).join(
          "",
        ),
      ).join(""),
    ).toMatch(/[=IS]/);
  });
});
describe("heart bounce deterministic flights", () => {
  it("has a descending serve and constructs legal hits with an >=0.8s handoff", () => {
    const serve = bounce.serve(0, 0),
      tick = bounce.paddleTick(serve),
      ball = bounce.ballAt(serve, tick);
    expect(bounce.canHit(serve, tick, ball.x / Q)).toBe(true);
    const hit = bounce.makeHit(serve, tick, ball.x / Q, 1, 10)!;
    expect(bounce.validateHit(serve, hit, 1, 10)).toBe(true);
    expect(bounce.paddleTick(hit) - hit.tick).toBeGreaterThanOrEqual(48);
    expect(bounce.fallbackTick(hit)).toBe(bounce.missTick(hit) + 90);
    expect(bounce.makeHit(serve, tick, 38, 1, 10)).toBeNull();
  });
  it("reflects walls, applies seeded wind and rejects forged trajectories", () => {
    const hit: bounce.Hit = {
      n: 31,
      tick: 10,
      x: 340 * Q,
      y: 200 * Q,
      vx: 7 * Q,
      vy: -5 * Q,
      wind: bounce.windFor(23, 31, 30),
    };
    const a = bounce.simulate(hit, 100),
      b = bounce.simulate(hit, 100);
    expect(a).toEqual(b);
    expect(a.x).toBeGreaterThanOrEqual(10 * Q);
    expect(a.x).toBeLessThanOrEqual(350 * Q);
    const serve = bounce.serve(0, 0),
      t = bounce.paddleTick(serve),
      next = bounce.makeHit(serve, t, 180, 1)!;
    expect(bounce.validateHit(serve, { ...next, x: next.x + Q }, 1)).toBe(
      false,
    );
    expect(bounce.validateHit(serve, { ...next, vy: -10000 }, 1)).toBe(false);
  });
});
