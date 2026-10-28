import { mulberry32 } from "../../shared/rng";
import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import { integer } from "../../shared/text";
import { createLevel, type Level } from "../../shared/games/red-thread/levels";
import * as red from "../../shared/games/red-thread/sim";
import { parameters, type Frame } from "../../shared/rollback";
import * as bounce from "../../shared/games/heart-bounce/sim";
export class RedThread extends BaseEngine {
  level: Level;
  state: Int32Array;
  checkpoint: Int32Array;
  logs: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  epoch = 0;
  inputDelay: number;
  maxRollback: number;
  paused = false;
  desyncs = 0;
  hashes = new Map<number, number>();
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("red-thread", run, o, seed, at, c);
    this.level = createLevel(String(o.level), seed);
    this.state = red.init(this.level);
    this.checkpoint = this.state.slice();
    const p = parameters(c.pair);
    this.inputDelay = p.inputDelay;
    this.maxRollback = p.maxRollback;
    this.neutral();
  }
  neutral() {
    const tick = this.state[0];
    for (let t = tick; t < tick + this.inputDelay; t++) {
      this.logs[0].set(t, 0);
      this.logs[1].set(t, 0);
    }
  }
  view() {
    return {
      level: this.options.level,
      seed: this.seed,
      startAt: this.startAt,
      epoch: this.epoch,
      tick: this.state[0],
      inputDelay: this.inputDelay,
      maxRollback: this.maxRollback,
      paused: this.paused,
      desyncs: this.desyncs,
      stats: red.read(this.state),
    };
  }
  data(_seat: Seat, kind: string) {
    if (kind !== "replay") throw new Error("INVALID");
    return {
      epoch: this.epoch,
      checkpoint: Array.from(this.checkpoint),
      frames: this.logs.map((log) => [...log].sort((a, b) => a[0] - b[0])),
      tick: this.state[0],
      state: Array.from(this.state),
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (cmd === "chk") {
      if (p?.epoch !== this.epoch) return false;
      const tick = integer(p.tick, 0, 100000000),
        hash = integer(p.hash, 0, 0xffffffff),
        expected = this.hashes.get(tick);
      if (expected !== undefined && expected !== hash) {
        this.desyncs++;
        this.ctx.emit(
          "resync",
          { epoch: this.epoch, tick: this.state[0] },
          seat,
        );
        return true;
      }
      return false;
    }
    if (cmd === "finish" && this.level.endless) {
      this.end();
      return true;
    }
    throw new Error("INVALID");
  }
  stream(seat: Seat, kind: string, p: any, now: number) {
    if (kind !== "rt" || p?.epoch !== this.epoch || this.paused || this.result)
      return;
    if (!Array.isArray(p.frames) || !p.frames.length || p.frames.length > 8)
      throw new Error("INVALID");
    const max = Math.max(
      this.state[0] + this.maxRollback + this.inputDelay + 8,
      Math.floor((now - this.startAt) * 0.06) + this.inputDelay + 12,
    );
    const frames: Frame[] = p.frames.map((pair: any) => {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error("INVALID");
      return [integer(pair[0], 0, Math.max(0, max)), integer(pair[1], 0, 31)];
    });
    for (const [t, bits] of frames) {
      if (t < this.checkpoint[0]) continue;
      const old = this.logs[seat].get(t);
      if (old !== undefined && old !== bits) throw new Error("INVALID");
      this.logs[seat].set(t, bits);
    }
    this.ctx.emit(
      "rt",
      { epoch: this.epoch, frames, seat },
      (1 - seat) as Seat,
    );
    let budget = 240;
    while (
      budget-- &&
      this.logs[0].has(this.state[0]) &&
      this.logs[1].has(this.state[0]) &&
      !this.result
    ) {
      const t = this.state[0];
      red.step(
        this.state,
        [this.logs[0].get(t)!, this.logs[1].get(t)!],
        this.level,
      );
      if (this.state[0] % 60 === 0) {
        this.hashes.set(this.state[0], red.hash(this.state));
        for (const tick of this.hashes.keys())
          if (tick < this.state[0] - 240) this.hashes.delete(tick);
      }
      if (red.read(this.state).won) {
        this.end();
        break;
      }
    }
    if (this.state[0] - this.checkpoint[0] >= 3600) {
      this.checkpoint = this.state.slice();
      for (const log of this.logs)
        for (const t of log.keys()) if (t < this.checkpoint[0]) log.delete(t);
    }
  }
  end() {
    const s = red.read(this.state);
    this.done(
      this.level.endless ? "一起攀登的高度" : "鹊桥相会",
      this.level.endless ? s.height + " 米" : (s.tick / 60).toFixed(1) + " 秒",
      [
        `收集 ${s.hearts} 颗爱心 · 掉落 ${s.deaths} 次`,
        `你们互相拉住了对方 ${s.rescues} 次`,
      ],
      {
        seconds: s.tick / 60,
        height: s.height,
        hearts: s.hearts,
        deaths: s.deaths,
        rescues: s.rescues,
      },
    );
  }
  pause() {
    this.paused = true;
    this.epoch++;
    for (const log of this.logs)
      for (const t of log.keys()) if (t >= this.state[0]) log.delete(t);
    this.neutral();
    this.ctx.emit("pause", { epoch: this.epoch, tick: this.state[0] });
  }
  resume() {
    this.paused = false;
  }
}
export class HeartBounce extends BaseEngine {
  hit: bounce.Hit;
  owner: Seat = 0;
  paddles = [180, 180];
  lives = 3;
  combo = 0;
  best = 0;
  score = 0;
  star: { x: number; y: number } | null = null;
  starTick = 0;
  wideUntil = 0;
  counts = [0, 0];
  epoch = 0;
  fallAt: number;
  paused = false;
  pausedTick = 0;
  pauseFallback = 0;
  pauseSettled = false;
  history: { n: number; owner: Seat; kind: string }[] = [];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("heart-bounce", run, o, seed, at, c);
    this.hit = bounce.serve(0, 0);
    this.fallAt = bounce.fallbackTick(this.hit);
  }
  time(now: number) {
    return Math.max(0, Math.floor((now - this.startAt) * 0.06));
  }
  paddleWidth(now: number) {
    return now < this.wideUntil
      ? Math.round(bounce.PADDLE_WIDTH * 1.6)
      : bounce.PADDLE_WIDTH;
  }
  collectStar(now: number) {
    if (!this.star || this.paused) return false;
    const end = Math.min(this.time(now), this.fallAt);
    for (let t = Math.max(this.starTick, this.hit.tick); t <= end; t++) {
      const p = bounce.ballAt(this.hit, t);
      if (Math.hypot(p.x / 256 - this.star.x, p.y / 256 - this.star.y) <= 24) {
        this.star = null;
        this.wideUntil = this.startAt + (t / 60) * 1000 + 10000;
        return true;
      }
    }
    this.starTick = end + 1;
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    if (this.wideUntil) this.wideUntil += ms;
  }
  view() {
    return {
      seed: this.seed,
      star: this.star,
      wideUntil: this.wideUntil,
      paused: this.paused,
      pausedTick: this.pausedTick,
      hit: this.hit,
      owner: this.owner,
      paddles: this.paddles,
      lives: this.lives,
      combo: this.combo,
      best: this.best,
      score: this.score,
      counts: this.counts,
      startAt: this.startAt,
      epoch: this.epoch,
    };
  }
  record(kind: string, owner: Seat) {
    this.history.push({ n: this.hit.n, owner, kind });
    if (this.history.length > 100) this.history.shift();
    this.ctx.emit("flight", this.view());
  }
  miss(tick: number) {
    const owner = this.owner;
    this.lives--;
    this.combo = 0;
    this.star = null;
    this.owner = (1 - owner) as Seat;
    this.hit = bounce.serve(this.hit.n + 1, tick);
    this.fallAt = bounce.fallbackTick(this.hit);
    this.record("miss", owner);
    if (!this.lives)
      this.done(
        "好好接住每一次心动",
        this.best + " 连击",
        [
          `总分 ${this.score} · 玩家 ${this.counts[0] >= this.counts[1] ? 1 : 2} 接得最多`,
        ],
        {
          score: this.score,
          stars:
            this.best >= 50 ? 3 : this.best >= 25 ? 2 : this.best >= 10 ? 1 : 0,
          best: this.best,
          player0: this.counts[0],
          player1: this.counts[1],
        },
      );
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (
      this.result ||
      this.paused ||
      p?.epoch !== this.epoch ||
      p.n !== this.hit.n ||
      seat !== this.owner
    )
      throw new Error("STALE");
    const tick = integer(p.tick, 0, 100000000);
    if (Math.abs(tick - this.time(now)) > 30) throw new Error("STALE");
    if (cmd === "hit") {
      const x = Number(p.x);
      if (!Number.isFinite(x) || x < 0 || x > 360) throw new Error("INVALID");
      const next = bounce.makeHit(
        this.hit,
        tick,
        x,
        this.combo + 1,
        this.seed,
        this.paddleWidth(this.startAt + (tick / 60) * 1000),
      );
      if (!next) throw new Error("INVALID");
      this.combo++;
      this.best = Math.max(this.best, this.combo);
      this.score += this.combo;
      this.counts[seat]++;
      this.hit = next;
      if (this.combo % 15 === 0) {
        const rand = mulberry32(this.seed ^ next.n);
        const contact = bounce.paddleTick(next),
          starAt =
            next.tick +
            Math.floor((contact - next.tick) * (0.35 + rand() * 0.3)),
          point = bounce.ballAt(next, starAt);
        this.star = { x: point.x / 256, y: point.y / 256 };
        this.starTick = next.tick;
      }
      this.owner = (1 - seat) as Seat;
      this.fallAt = bounce.fallbackTick(next);
      this.record("hit", seat);
      return true;
    }
    if (cmd === "miss") {
      if (tick < bounce.missTick(this.hit)) throw new Error("INVALID");
      this.miss(tick);
      return true;
    }
    throw new Error("INVALID");
  }
  stream(seat: Seat, kind: string, p: any, now: number) {
    if (kind !== "cur" || p?.epoch !== this.epoch || this.paused) return;
    const x = Number(p.x);
    if (!Number.isFinite(x)) throw new Error("INVALID");
    this.paddles[seat] = bounce.paddleX(x, this.paddleWidth(now));
    this.ctx.emit("paddle", { seat, x: this.paddles[seat] }, undefined, true);
  }
  tick(now: number) {
    if (this.result) return false;
    if (this.paused) {
      if (this.pauseFallback && now >= this.pauseFallback) {
        this.pauseFallback = 0;
        this.pauseSettled = true;
        this.miss(this.pausedTick);
        return true;
      }
      return false;
    }
    const collected = this.collectStar(now);
    if (this.time(now) >= this.fallAt) {
      this.miss(this.time(now));
      return true;
    }
    return collected;
  }
  pause(now: number) {
    this.paused = true;
    this.pausedTick = this.time(now);
    this.epoch++;
    this.pauseFallback = 0;
    this.pauseSettled = false;
  }
  ownerDisconnected(seat: Seat, now: number) {
    if (seat === this.owner && !this.pauseSettled)
      this.pauseFallback = Math.max(
        now + 1500,
        this.startAt + (this.fallAt / 60) * 1000,
      );
  }
  resume() {
    this.paused = false;
    this.pauseFallback = 0;
  }
}
