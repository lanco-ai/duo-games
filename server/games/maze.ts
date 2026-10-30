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
  // Optional detours: hearts wait in dead ends, ghosts patrol side branches.
  // Neither ever touches the critical path, so a perfect run stays possible.
  const open = (c: number) => {
      const x = c % w,
        y = Math.floor(c / w);
      return x >= 0 && x < w && y >= 0 && y < h && !grid[c];
    },
    neighbours = (c: number) =>
      directions
        .filter(([dx, dy]) => {
          const x = (c % w) + dx;
          return x >= 0 && x < w && open(c + dy * w + dx);
        })
        .map(([dx, dy]) => c + dy * w + dx),
    reserved = new Set([start, exit, key, door, ...traps, ...path]),
    side = queue.filter((c) => !reserved.has(c)),
    deadEnds = side.filter((c) => neighbours(c).length === 1),
    heartCount = [1, 2, 3, 3, 3, 3][round],
    hearts = [
      ...shuffled(deadEnds, seed + 11),
      ...shuffled(
        side.filter((c) => !deadEnds.includes(c)),
        seed + 13,
      ),
    ].slice(0, heartCount);
  // A single-corridor maze has no detours: hearts then lie along the way.
  if (hearts.length < heartCount)
    hearts.push(
      ...shuffled(
        path.filter((c) => ![start, exit, key, door, ...hearts].includes(c)),
        seed + 19,
      ).slice(0, heartCount - hearts.length),
    );
  const ghosts: number[][] = [];
  if (round >= 2) {
    const taken = new Set(hearts);
    for (const first of shuffled(side, seed + 17)) {
      if (ghosts.length >= (round >= 4 ? 2 : 1)) break;
      if (taken.has(first) || ghosts.some((g) => g.includes(first))) continue;
      const lane = [first];
      while (lane.length < 4) {
        const step = neighbours(lane.at(-1)!).find(
          (c) =>
            !reserved.has(c) &&
            !lane.includes(c) &&
            !ghosts.some((g) => g.includes(c)),
        );
        if (step === undefined) break;
        lane.push(step);
      }
      if (lane.length >= 2) ghosts.push(lane);
    }
  }
  return { w, h, grid, start, exit, door, key, traps, hearts, ghosts };
}
export const mazeScenes = [
  "晨雾花园",
  "萤火森林",
  "糖果洞穴",
  "星空遗迹",
  "月光城堡",
  "鹊桥云海",
];
const signalTexts = [
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
  "有幽灵，快跑！",
  "那边有💗",
  "相信我",
];
const replyTexts = [
  "收到！",
  "你确定？",
  "我怕怕",
  "再说一遍",
  "爱你哟",
  "冲鸭",
];
/** Ping-pong position along a patrol lane at a given elapsed time. */
export function ghostCell(lane: number[], elapsed: number, period: number) {
  const span = (lane.length - 1) * 2,
    step = Math.max(0, Math.floor(elapsed / period)) % span;
  return lane[step < lane.length ? step : span - step];
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
  history: {
    stars: number;
    time: number;
    guide: Seat;
    hearts: number;
    streak: number;
  }[] = [];
  light: { cell: number; until: number } | null = null;
  signal: { text: string; at: number } | null = null;
  reply: { text: string; at: number } | null = null;
  route: { cells: number[]; until: number } | null = null;
  routeUsed = false;
  stage = "walking";
  signals: number[] = [];
  replies: number[] = [];
  hearts = new Set<number>();
  heartTotal = 0;
  scares = 0;
  streak = 0;
  bestStreak = 0;
  trail: number[] = [];
  safeUntil = 0;
  ghostStep = -1;
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
  get period() {
    return this.round >= 4 ? 650 : 850;
  }
  ghostCells(now: number) {
    return this.maze.ghosts.map((lane) =>
      ghostCell(lane, now - this.roundStart, this.period),
    );
  }
  /** A ghost on the walker's cell knocks them three steps back along the trail. */
  scare(now: number) {
    if (now < this.safeUntil || this.stage !== "walking") return false;
    if (!this.ghostCells(now).includes(this.pos)) return false;
    const back = this.trail.splice(Math.max(0, this.trail.length - 3));
    this.pos = back[0] ?? this.maze.start;
    this.scares++;
    this.streak = 0;
    this.safeUntil = now + 1500;
    this.ctx.emit("scared", { pos: this.pos, round: this.round });
    return true;
  }
  tick(now: number) {
    if (this.stage !== "walking" || !this.maze.ghosts.length) return false;
    const step = Math.floor((now - this.roundStart) / this.period);
    if (step === this.ghostStep) return false;
    this.ghostStep = step;
    this.scare(now);
    return true;
  }
  view(seat: Seat, now: number) {
    const m = this.maze,
      guide = seat !== this.round % 2,
      px = this.pos % m.w,
      py = Math.floor(this.pos / m.w),
      dist = (c: number) =>
        Math.abs(px - (c % m.w)) + Math.abs(py - Math.floor(c / m.w)),
      nearExit = dist(m.exit) <= 1,
      ghosts = this.ghostCells(now);
    return {
      round: this.round,
      scene: mazeScenes[this.round],
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
      scares: this.scares,
      lights: this.lights,
      routeUsed: this.routeUsed,
      route: this.route && now < this.route.until ? this.route : null,
      lastMove: this.lastMove,
      stage: this.stage,
      stars: this.stars,
      roundStart: this.roundStart,
      history: this.history,
      got: [...this.hearts],
      heartGoal: m.hearts.length,
      heartTotal: this.heartTotal,
      streak: this.streak,
      bestStreak: this.bestStreak,
      safe: now < this.safeUntil,
      ...(guide
        ? {
            grid: m.grid,
            traps: m.traps,
            key: m.key,
            door: m.door,
            exit: m.exit,
            hearts: m.hearts,
            ghosts,
          }
        : {
            exit: nearExit ? m.exit : null,
            key: this.hasKey ? m.key : null,
            door: this.walls.has(m.door) ? m.door : null,
            // The walker only senses what is right beside the lantern.
            nearHearts: m.hearts.filter(
              (c) => !this.hearts.has(c) && dist(c) <= 1,
            ),
            nearGhosts: ghosts.filter((c) => dist(c) <= 2),
          }),
      signal: this.signal && now < this.signal.at + 3000 ? this.signal : null,
      reply: this.reply && now < this.reply.at + 3000 ? this.reply : null,
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
          [
            `最佳指挥：玩家 ${best.guide + 1}，${best.time.toFixed(1)} 秒`,
            `收集爱心 ${this.heartTotal} / 15 💗`,
            `最长默契连走 ${this.bestStreak} 步`,
          ],
          {
            stars: this.stars,
            rounds: 6,
            hearts: this.heartTotal,
            streak: this.bestStreak,
          },
        );
        return true;
      }
      this.round++;
      this.maze = makeMaze(this.round, this.seed + this.round * 17);
      this.pos = this.maze.start;
      this.seen = new Set([this.pos]);
      this.walls.clear();
      this.traps.clear();
      this.hearts.clear();
      this.hasKey = false;
      this.bumps = 0;
      this.falls = 0;
      this.scares = 0;
      this.streak = 0;
      this.trail = [];
      this.safeUntil = 0;
      this.ghostStep = -1;
      this.lights = 3;
      this.lastMove = -1;
      this.roundStart = now;
      this.light = null;
      this.signal = null;
      this.reply = null;
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
        trap = false,
        heart = false,
        key = false,
        scared = false;
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
        this.streak = 0;
        bump = true;
      } else {
        this.trail.push(this.pos);
        this.pos = next;
        this.seen.add(next);
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        if (next === m.key && !this.hasKey) {
          this.hasKey = true;
          key = true;
        }
        if (m.hearts.includes(next) && !this.hearts.has(next)) {
          this.hearts.add(next);
          this.heartTotal++;
          heart = true;
        }
        if (m.traps.includes(next)) {
          this.traps.add(next);
          this.pos = m.start;
          this.trail = [];
          this.falls++;
          this.streak = 0;
          trap = true;
        } else scared = this.scare(now);
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
            hearts: this.hearts.size,
            streak: this.bestStreak,
          });
          this.stage = "complete";
        }
      }
      this.ctx.emit(
        "moved",
        {
          n,
          pos: this.pos,
          bump,
          trap,
          heart,
          key,
          scared,
          streak: this.streak,
          round: this.round,
        },
        walker,
      );
      return true;
    }
    if (cmd === "reply") {
      if (seat !== walker) throw new Error("NOT_YOUR_TURN");
      if (!replyTexts.includes(p.text)) throw new Error("INVALID");
      this.replies = this.replies.filter((t) => now - t < 1000);
      if (this.replies.length >= 3) throw new Error("RATE_LIMITED");
      this.replies.push(now);
      this.reply = { text: p.text, at: now };
      this.ctx.emit("reply", this.reply, (1 - walker) as Seat);
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
      if (!signalTexts.includes(p.text)) throw new Error("INVALID");
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
    this.safeUntil += ms;
    if (this.light) this.light.until += ms;
    if (this.route) this.route.until += ms;
    if (this.signal) this.signal.at += ms;
    if (this.reply) this.reply.at += ms;
  }
}
