import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import { integer } from "../../shared/text";
import * as sling from "../../shared/games/puck-sling/sim";
/** Ticks the server waits before a board state is final; late shots may still land before it. */
const SETTLE = 60;
/** Shots may be stamped up to half a second in the past to absorb latency. */
const LATE = 30;
/** A half must stay empty this long to count as cleared. */
const CLEAR = 30;
export class PuckSling extends BaseEngine {
  base: sling.State = sling.initial();
  shots: sling.Shot[] = [];
  last: [number, number] = [-sling.COOLDOWN, -sling.COOLDOWN];
  fired: [number, number] = [0, 0];
  clearSince: [number, number] = [-1, -1];
  limit: number;
  epoch = 0;
  paused = false;
  pausedTick = 0;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("puck-sling", run, o, seed, at, c);
    this.limit = Number(o.minutes) * 60 * sling.HZ;
  }
  time(now: number) {
    if (this.paused) return this.pausedTick;
    return Math.max(0, Math.floor((now - this.startAt) * 0.06));
  }
  view() {
    return {
      startAt: this.startAt,
      epoch: this.epoch,
      paused: this.paused,
      pausedTick: this.pausedTick,
      limit: this.limit,
      base: this.base,
      shots: this.shots,
      fired: this.fired,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (cmd !== "shot") throw new Error("INVALID");
    if (this.result || this.paused || p?.epoch !== this.epoch)
      throw new Error("STALE");
    const current = this.time(now),
      tick = Math.max(
        integer(p.tick, 0, 100000000),
        current - LATE,
        this.base.tick,
        this.last[seat] + sling.COOLDOWN,
      ),
      id = integer(p.id, 0, sling.PER_SIDE * 2 - 1),
      dx = integer(p.dx, -sling.MAX_PULL, sling.MAX_PULL),
      dy = integer(p.dy, -sling.MAX_PULL, sling.MAX_PULL);
    if (tick > current + 6 || tick >= this.limit) throw new Error("STALE");
    if (!sling.validPull(seat, dx, dy)) throw new Error("INVALID");
    const at = sling.advance(this.base, this.shots, tick);
    if (!sling.grabbable(at.pucks[id], seat)) throw new Error("STALE");
    const shot: sling.Shot = { tick, seat, id, dx, dy };
    // Keep the list ordered by tick; a later shot may arrive before an earlier one.
    let i = this.shots.length;
    while (i > 0 && this.shots[i - 1].tick > tick) i--;
    this.shots.splice(i, 0, shot);
    this.last[seat] = tick;
    this.fired[seat]++;
    return true;
  }
  finish(state: sling.State) {
    const [a, b] = sling.counts(state),
      winner = a === b ? -1 : a < b ? 0 : 1;
    this.done(
      winner < 0 ? "旗鼓相当" : "清台成功",
      winner < 0 ? "平局" : `玩家 ${winner + 1} 获胜`,
      [`剩余冰球 ${a} : ${b}`, `弹射次数 ${this.fired[0]} : ${this.fired[1]}`],
      {
        player0: a,
        player1: b,
        shots0: this.fired[0],
        shots1: this.fired[1],
        seconds: Math.round(state.tick / sling.HZ),
      },
    );
  }
  tick(now: number) {
    if (this.result || this.paused) return false;
    const settled = Math.min(this.time(now) - SETTLE, this.limit);
    if (settled <= this.base.tick) return false;
    this.base = sling.advance(this.base, this.shots, settled);
    this.shots = this.shots.filter((s) => s.tick >= settled);
    const c = sling.counts(this.base);
    for (const seat of [0, 1] as Seat[]) {
      if (c[seat]) this.clearSince[seat] = -1;
      else if (this.clearSince[seat] < 0) this.clearSince[seat] = settled;
      if (
        this.clearSince[seat] >= 0 &&
        settled - this.clearSince[seat] >= CLEAR
      ) {
        this.finish(this.base);
        return true;
      }
    }
    if (settled >= this.limit) {
      this.finish(this.base);
      return true;
    }
    return false;
  }
  pause(now: number) {
    this.pausedTick = this.time(now);
    this.paused = true;
    this.epoch++;
  }
  resume() {
    this.paused = false;
  }
}
