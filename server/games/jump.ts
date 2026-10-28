import { unlockedLevel, unlockNext } from "../../shared/games/progress";
import { BaseEngine } from "./base";
import { mulberry32 } from "../../shared/rng";
import {
  jumpLevels,
  jumpLanding,
  type JumpPlatform,
} from "../../shared/games/couple-jump/levels";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
export class CoupleJump extends BaseEngine {
  rand: () => number;
  step = 0;
  points = 0;
  combo = 0;
  lives = 3;
  level: number;
  endless: boolean;
  started: [number | null, number | null] = [null, null];
  charges: [number | null, number | null] = [null, null];
  releasedAt: [number | null, number | null] = [null, null];
  platforms: JumpPlatform[] = [];
  last: any = null;
  stoodAt: number;
  attempt = 0;
  inputN = [-1, -1];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("couple-jump", run, o, seed, at, c);
    this.rand = mulberry32(seed);
    this.endless = o.level === "endless" && unlockedLevel(c, this.id, 5) >= 5;
    this.level = this.endless
      ? 3
      : Math.max(
          0,
          Math.min(unlockedLevel(c, this.id, 4) - 1, Number(o.level || 1) - 1),
        );
    this.stoodAt = at;
    this.nextTarget();
  }
  nextTarget() {
    const l = jumpLevels[this.level];
    this.platforms = [0, 1].map((i) => ({
      x:
        l.min +
        Math.floor(this.rand() * l.range) +
        (this.options.mode === "sync" ? i * 35 : 0),
      y: i ? 190 : 235,
      width: l.width,
      amplitude: l.moving,
      phase: this.rand() * 6.28,
      heart: l.heart && this.step % 4 === 3,
    }));
  }
  view(_seat?: Seat, now = this.startAt) {
    return {
      startAt: this.startAt,
      step: this.step,
      points: this.points,
      combo: this.combo,
      lives: this.lives,
      level: this.level,
      levelName: jumpLevels[this.level].name,
      total: this.endless ? null : jumpLevels[this.level].jumps,
      mode: this.options.mode,
      platforms: this.platforms.map((p) => ({
        ...p,
        baseX: p.x,
        x: p.x + Math.sin((now - this.startAt) / 1300 + p.phase) * p.amplitude,
      })),
      inputN: [...this.inputN],
      charging: this.started.map((x) => x !== null),
      released: this.charges.map((x) => x !== null),
      last: this.last,
      attempt: this.attempt,
      iceDeadline: jumpLevels[this.level].ice ? this.stoodAt + 2000 : null,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw Error("INVALID");
    if (this.options.mode === "relay" && seat !== this.step % 2)
      throw Error("NOT_YOUR_TURN");
    if (cmd === "press") {
      if (this.started[seat] !== null || this.charges[seat] !== null)
        throw Error("INVALID");
      if (
        p?.n !== undefined &&
        (!Number.isSafeInteger(p.n) || p.n <= this.inputN[seat])
      )
        throw Error("STALE");
      this.inputN[seat] = p?.n ?? this.inputN[seat] + 1;
      this.started[seat] = now;
      return true;
    }
    if (
      cmd !== "release" ||
      this.started[seat] === null ||
      (p?.n !== undefined && p.n !== this.inputN[seat])
    )
      throw Error("INVALID");
    this.charges[seat] = Math.min(2200, Math.max(0, now - this.started[seat]!));
    this.started[seat] = null;
    this.releasedAt[seat] = now;
    if (this.options.mode === "relay" || this.charges.every((x) => x !== null))
      this.resolve(now);
    return true;
  }
  resolve(now: number) {
    const sync = this.options.mode === "sync",
      seats = sync ? [0, 1] : [this.step % 2],
      elapsed = now - this.startAt;
    const landings = seats.map((s) =>
      jumpLanding(this.charges[s]!, this.platforms[sync ? s : 0], elapsed),
    );
    const together =
        !sync || Math.abs(this.releasedAt[0]! - this.releasedAt[1]!) <= 300,
      landed = together && landings.every((x) => x.landed),
      center = landings.every((x) => x.center),
      perfect = sync && landed && center;
    this.last = {
      landed,
      center: landed && center,
      perfect,
      landings,
      at: now,
      attempt: this.attempt,
    };
    this.attempt++;
    this.started = [null, null];
    this.charges = [null, null];
    this.releasedAt = [null, null];
    this.stoodAt = now;
    if (!landed) {
      this.lives--;
      this.combo = 0;
      if (this.lives === 0) this.finish(false);
      return;
    }
    this.step++;
    this.combo = center ? this.combo + 1 : 0;
    this.points += perfect ? 4 : center ? 2 : 1;
    if (perfect && this.platforms[0].heart)
      this.lives = Math.min(3, this.lives + 1);
    if (!this.endless && this.step >= jumpLevels[this.level].jumps)
      this.finish(true);
    else this.nextTarget();
  }
  finish(won: boolean) {
    const stars = won ? this.lives : 0;
    this.done(
      won ? "旅程通关" : "旅程暂时结束",
      `${stars ? "★".repeat(stars) : this.points + " 分"}`,
      [
        `${jumpLevels[this.level].name} · 一起跳过 ${this.step} 个平台`,
        "下一段路，也要牵着你。",
      ],
      {
        score: this.points,
        steps: this.step,
        stars,
        level: this.level + 1,
        unlocked: won ? Math.min(5, this.level + 2) : this.level + 1,
      },
    );
    if (won) unlockNext(this.ctx, this.id, this.level + 1, 5);
    if (won)
      this.ctx.gallery("journey", "牵手跳过" + jumpLevels[this.level].name, {
        steps: this.step,
        stars,
        score: this.points,
      });
  }
  tick(now: number) {
    if (this.result) return false;
    const pending = this.releasedAt.filter((x): x is number => x !== null);
    if (
      (pending.length === 1 && now - pending[0] > 300) ||
      (jumpLevels[this.level].ice && now - this.stoodAt >= 2000)
    ) {
      this.last = { landed: false, at: now };
      this.attempt++;
      this.lives--;
      this.started = [null, null];
      this.charges = [null, null];
      this.releasedAt = [null, null];
      this.stoodAt = now;
      if (!this.lives) this.finish(false);
      return true;
    }
    return false;
  }
  pause() {
    // A physical hold cannot survive a page replacement. Fence delayed releases too.
    this.started = [null, null];
    this.charges = [null, null];
    this.releasedAt = [null, null];
    this.inputN = this.inputN.map((n) => n + 1);
    this.attempt++;
  }
  shift(ms: number) {
    super.shift(ms);
    this.stoodAt += ms;
    this.started = this.started.map((x) =>
      x === null ? null : x + ms,
    ) as typeof this.started;
    this.releasedAt = this.releasedAt.map((x) =>
      x === null ? null : x + ms,
    ) as typeof this.releasedAt;
    if (this.last?.at) this.last.at += ms;
  }
}
