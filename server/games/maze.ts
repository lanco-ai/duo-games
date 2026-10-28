import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import { mulberry32, shuffled } from "../../shared/rng";
import { integer } from "../../shared/text";
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export function makeMaze(round: number, seed: number) {
  const [w, h] = [
      [7, 9],
      [9, 9],
      [9, 11],
      [11, 13],
      [11, 15],
      [13, 17],
    ][round],
    random = mulberry32(seed),
    grid = Array(w * h).fill(1),
    start = w + 1,
    stack = [start];
  grid[start] = 0;
  while (stack.length) {
    const cell = stack.at(-1)!,
      x = cell % w,
      y = Math.floor(cell / w),
      available = directions.filter(
        ([dx, dy]) =>
          x + dx * 2 > 0 &&
          x + dx * 2 < w - 1 &&
          y + dy * 2 > 0 &&
          y + dy * 2 < h - 1 &&
          grid[(y + dy * 2) * w + x + dx * 2] === 1,
      );
    if (!available.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = available[Math.floor(random() * available.length)];
    grid[(y + dy) * w + x + dx] = 0;
    const next = (y + dy * 2) * w + x + dx * 2;
    grid[next] = 0;
    stack.push(next);
  }
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (
        grid[y * w + x] &&
        random() < 0.1 &&
        ((!grid[y * w + x - 1] && !grid[y * w + x + 1]) ||
          (!grid[(y - 1) * w + x] && !grid[(y + 1) * w + x]))
      )
        grid[y * w + x] = 0;
  const queue = [start],
    prev = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of directions) {
      const c = queue[i],
        x = (c % w) + dx,
        y = Math.floor(c / w) + dy,
        n = y * w + x;
      if (x >= 0 && x < w && y >= 0 && y < h && !grid[n] && !prev.has(n)) {
        prev.set(n, c);
        queue.push(n);
      }
    }
  const exit = queue.at(-1)!,
    path: number[] = [];
  for (let c = exit; c !== -1; c = prev.get(c)!) path.unshift(c);
  const door = round >= 3 ? path[Math.floor(path.length * 0.6)] : -1,
    key = round >= 3 ? path[Math.max(1, Math.floor(path.length * 0.3))] : -1;
  const traps =
    round >= 2
      ? shuffled(
          queue.filter((c) => !path.includes(c)),
          seed + 7,
        ).slice(0, round - 1)
      : [];
  if (round >= 2 && !traps.length) {
    for (let cell = w + 1; cell < (h - 1) * w; cell++) {
      const x = cell % w,
        y = Math.floor(cell / w);
      if (
        x > 0 &&
        x < w - 1 &&
        grid[cell] === 1 &&
        directions.some(([dx, dy]) => grid[(y + dy) * w + x + dx] === 0)
      ) {
        grid[cell] = 0;
        traps.push(cell);
        break;
      }
    }
  }
  return { w, h, grid, start, exit, door, key, traps };
}
export class MyEyes extends BaseEngine {
  round = 0;
  maze: ReturnType<typeof makeMaze>;
  pos: number;
  seen = new Set<number>();
  walls = new Set<number>();
  traps = new Set<number>();
  hasKey = false;
  bumps = 0;
  falls = 0;
  lights = 3;
  lastMove = -1;
  roundStart: number;
  stars = 0;
  history: { stars: number; time: number; guide: Seat }[] = [];
  light: { cell: number; until: number } | null = null;
  signal: { text: string; at: number } | null = null;
  route: { cells: number[]; until: number } | null = null;
  routeUsed = false;
  stage = "walking";
  signals: number[] = [];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("my-eyes", run, o, seed, at, c);
    this.maze = makeMaze(0, seed);
    this.pos = this.maze.start;
    this.seen.add(this.pos);
    this.roundStart = at;
  }
  view(seat: Seat, now: number) {
    const m = this.maze,
      guide = seat !== this.round % 2,
      nearExit =
        Math.abs((this.pos % m.w) - (m.exit % m.w)) +
          Math.abs(Math.floor(this.pos / m.w) - Math.floor(m.exit / m.w)) <=
        1;
    return {
      round: this.round,
      walker: this.round % 2,
      w: m.w,
      h: m.h,
      pos: this.pos,
      seen: [...this.seen],
      walls: [...this.walls],
      triggered: [...this.traps],
      hasKey: this.hasKey,
      bumps: this.bumps,
      falls: this.falls,
      lights: this.lights,
      routeUsed: this.routeUsed,
      route: this.route && now < this.route.until ? this.route : null,
      lastMove: this.lastMove,
      stage: this.stage,
      stars: this.stars,
      roundStart: this.roundStart,
      history: this.history,
      ...(guide
        ? {
            grid: m.grid,
            traps: m.traps,
            key: m.key,
            door: m.door,
            exit: m.exit,
          }
        : {
            exit: nearExit ? m.exit : null,
            key: this.hasKey ? m.key : null,
            door: this.walls.has(m.door) ? m.door : null,
          }),
      signal: this.signal && now < this.signal.at + 3000 ? this.signal : null,
      light:
        this.light && now < this.light.until
          ? { ...this.light, wall: m.grid[this.light.cell] === 1 }
          : null,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || p?.round !== this.round) throw new Error("STALE");
    const walker = (this.round % 2) as Seat,
      m = this.maze;
    if (cmd === "next") {
      if (this.stage !== "complete") throw new Error("INVALID");
      if (this.round === 5) {
        const best = [...this.history].sort((a, b) => a.time - b.time)[0];
        this.done(
          "一起走出迷雾",
          this.stars + " / 18 星",
          [`最佳指挥：玩家 ${best.guide + 1}，${best.time.toFixed(1)} 秒`],
          { stars: this.stars, rounds: 6 },
        );
        return true;
      }
      this.round++;
      this.maze = makeMaze(this.round, this.seed + this.round * 17);
      this.pos = this.maze.start;
      this.seen = new Set([this.pos]);
      this.walls.clear();
      this.traps.clear();
      this.hasKey = false;
      this.bumps = 0;
      this.falls = 0;
      this.lights = 3;
      this.lastMove = -1;
      this.roundStart = now;
      this.light = null;
      this.signal = null;
      this.route = null;
      this.routeUsed = false;
      this.stage = "walking";
      return true;
    }
    if (this.stage !== "walking") throw new Error("INVALID");
    if (cmd === "move") {
      if (seat !== walker) throw new Error("NOT_YOUR_TURN");
      const n = integer(p.n, 0, 100000);
      if (n <= this.lastMove) return false;
      if (n !== this.lastMove + 1) throw new Error("STALE");
      const dir = integer(p.dir, 0, 3),
        [dx, dy] = directions[dir],
        x = (this.pos % m.w) + dx,
        y = Math.floor(this.pos / m.w) + dy,
        next = y * m.w + x;
      this.lastMove = n;
      let bump = false,
        trap = false;
      if (
        x < 0 ||
        x >= m.w ||
        y < 0 ||
        y >= m.h ||
        m.grid[next] === 1 ||
        (next === m.door && !this.hasKey)
      ) {
        this.walls.add(next);
        this.bumps++;
        bump = true;
      } else {
        this.pos = next;
        this.seen.add(next);
        if (next === m.key) this.hasKey = true;
        if (m.traps.includes(next)) {
          this.traps.add(next);
          this.pos = m.start;
          this.falls++;
          trap = true;
        }
        if (next === m.exit && (m.key < 0 || this.hasKey)) {
          const seconds = (now - this.roundStart) / 1000,
            stars =
              Number(seconds <= 45 + this.round * 20) +
              Number(this.bumps <= 3) +
              Number(this.falls === 0);
          this.stars += stars;
          this.history.push({
            stars,
            time: seconds,
            guide: (1 - walker) as Seat,
          });
          this.stage = "complete";
        }
      }
      this.ctx.emit(
        "moved",
        { n, pos: this.pos, bump, trap, round: this.round },
        walker,
      );
      return true;
    }
    if (seat === walker) throw new Error("NOT_YOUR_TURN");
    if (cmd === "route") {
      if (
        this.routeUsed ||
        !Array.isArray(p.cells) ||
        p.cells.length < 2 ||
        p.cells.length > m.grid.length
      )
        throw new Error("INVALID");
      const cells = p.cells.map((cell: unknown) =>
        integer(cell, 0, m.grid.length - 1),
      );
      if (
        cells[0] !== this.pos ||
        new Set(cells).size !== cells.length ||
        cells.some((cell: number, i: number) => {
          if (m.grid[cell]) return true;
          if (!i) return false;
          const prev = cells[i - 1];
          return (
            Math.abs((cell % m.w) - (prev % m.w)) +
              Math.abs(Math.floor(cell / m.w) - Math.floor(prev / m.w)) !==
            1
          );
        })
      )
        throw new Error("INVALID");
      this.route = { cells, until: now + 2000 };
      this.routeUsed = true;
      return true;
    }
    if (cmd === "signal") {
      const allowed = [
        "↑",
        "→",
        "↓",
        "←",
        "停！",
        "往前走两步",
        "回头",
        "左边有坑",
        "对对对",
        "别动",
      ];
      if (!allowed.includes(p.text)) throw new Error("INVALID");
      this.signals = this.signals.filter((t) => now - t < 1000);
      if (this.signals.length >= 3) throw new Error("RATE_LIMITED");
      this.signals.push(now);
      this.signal = { text: p.text, at: now };
      this.ctx.emit("signal", this.signal, walker);
      return true;
    }
    if (cmd === "light") {
      if (!this.lights) throw new Error("INVALID");
      const cell = integer(p.cell, 0, m.grid.length - 1);
      this.lights--;
      this.light = { cell, until: now + 3000 };
      return true;
    }
    throw new Error("INVALID");
  }
  shift(ms: number) {
    super.shift(ms);
    this.roundStart += ms;
    if (this.light) this.light.until += ms;
    if (this.route) this.route.until += ms;
    if (this.signal) this.signal.at += ms;
  }
}
