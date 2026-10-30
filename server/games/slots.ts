import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import { mulberry32 } from "../../shared/rng";
import { integer } from "../../shared/text";
import {
  symbols,
  weights,
  strip,
  stripAt,
  judge,
  title,
  reactions,
  STOP1,
  STOP2,
  AUTO_STOP,
  type Outcome,
} from "../../shared/games/love-slots/rules";
export class LoveSlots extends BaseEngine {
  pull = 0;
  maxPulls: number;
  coins = 20;
  turn: Seat = 0;
  phase: "bet" | "spinning" | "task" = "bet";
  bet = 1;
  spinAt = 0;
  reels: string[] = [];
  offset = 0;
  stopped: string | null = null;
  outcome: (Outcome & { delta: number }) | null = null;
  log: { seat: Seat; reels: string[]; name: string; delta: number }[] = [];
  wishes = [0, 0];
  jackpots = 0;
  sweet = 0;
  skipped = 0;
  stepSeen = 0;
  reacts: number[] = [];
  random: () => number;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("love-slots", run, o, seed, at, c);
    this.maxPulls = Number(o.pulls) || 10;
    this.random = mulberry32(seed);
    this.turn = ((seed >>> 0) % 2) as Seat;
  }
  roll() {
    let r = this.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < symbols.length; i++)
      if ((r -= weights[i]) < 0) return symbols[i];
    return symbols[0];
  }
  view(_seat: Seat, now: number) {
    const elapsed = now - this.spinAt,
      spinning = this.phase === "spinning";
    return {
      pull: this.pull,
      maxPulls: this.maxPulls,
      coins: this.coins,
      turn: this.turn,
      phase: this.phase,
      bet: this.bet,
      spinAt: this.spinAt,
      offset: this.offset,
      strip,
      // Auto reels are only revealed once they have visibly stopped.
      reels: spinning
        ? [
            elapsed >= STOP1 ? this.reels[0] : null,
            elapsed >= STOP2 ? this.reels[1] : null,
            null,
          ]
        : this.phase === "task"
          ? [...this.reels.slice(0, 2), this.stopped]
          : [null, null, null],
      outcome: this.phase === "task" ? this.outcome : null,
      log: this.log.slice(-6),
      wishes: this.wishes,
      jackpots: this.jackpots,
      sweet: this.sweet,
    };
  }
  tick(now: number) {
    if (this.phase !== "spinning") return false;
    const elapsed = now - this.spinAt;
    if (elapsed >= AUTO_STOP) {
      this.stop(this.spinAt + AUTO_STOP, true);
      return true;
    }
    const step = elapsed >= STOP2 ? 2 : elapsed >= STOP1 ? 1 : 0;
    if (step === this.stepSeen) return false;
    this.stepSeen = step;
    return true;
  }
  stop(at: number, auto = false) {
    this.stopped = stripAt(this.offset, at - this.spinAt);
    const reels = [...this.reels.slice(0, 2), this.stopped],
      o = judge(reels, Math.floor(this.random() * 1000)),
      delta = this.bet * o.mult - o.penalty;
    this.coins = Math.max(0, this.coins + delta);
    if (o.jackpot) this.jackpots++;
    if (o.wish) this.wishes[this.turn]++;
    this.outcome = { ...o, delta };
    this.log.push({ seat: this.turn, reels, name: o.name, delta });
    this.phase = "task";
    this.ctx.emit("stopped", {
      pull: this.pull,
      reels,
      name: o.name,
      delta,
      jackpot: o.jackpot,
      auto,
    });
  }
  advance() {
    this.pull++;
    if (this.pull >= this.maxPulls || this.coins <= 0) {
      this.done(
        title(this.coins),
        this.coins + " 枚爱心币",
        [
          `一共拉了 ${this.pull} 次，命中注定 ${this.jackpots} 次`,
          `完成甜蜜任务 ${this.sweet} 个，耍赖 ${this.skipped} 次`,
          ...[0, 1]
            .filter((s) => this.wishes[s])
            .map((s) => `玩家 ${s + 1} 赢得心愿券 ×${this.wishes[s]}`),
        ],
        {
          coins: this.coins,
          pulls: this.pull,
          jackpots: this.jackpots,
          sweet: this.sweet,
        },
      );
      return;
    }
    this.turn = (1 - this.turn) as Seat;
    this.phase = "bet";
    this.outcome = null;
    this.reels = [];
    this.stopped = null;
    this.bet = Math.min(this.bet, this.coins);
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw new Error("STALE");
    if (cmd === "react") {
      const emoji = String(p?.emoji);
      if (!reactions.includes(emoji)) throw new Error("INVALID");
      this.reacts = this.reacts.filter((t) => now - t < 1000);
      if (this.reacts.length >= 4) throw new Error("RATE_LIMITED");
      this.reacts.push(now);
      this.ctx.emit("react", { emoji, seat }, undefined, true);
      return false;
    }
    if (p?.pull !== this.pull) throw new Error("STALE");
    const partner = (1 - this.turn) as Seat;
    if (cmd === "spin") {
      if (this.phase !== "bet") throw new Error("INVALID");
      if (seat !== this.turn) throw new Error("NOT_YOUR_TURN");
      const bet = integer(p.bet, 1, 3);
      if (bet > this.coins) throw new Error("INVALID");
      this.bet = bet;
      this.coins -= bet;
      this.reels = [this.roll(), this.roll()];
      this.offset = Math.floor(this.random() * strip.length);
      this.spinAt = now;
      this.stepSeen = 0;
      this.phase = "spinning";
      return true;
    }
    if (cmd === "stop") {
      if (this.phase !== "spinning") throw new Error("INVALID");
      if (seat !== partner) throw new Error("NOT_YOUR_TURN");
      if (now - this.spinAt < STOP2) throw new Error("TOO_EARLY");
      // The tap time comes from the synced clock; allow for network delay only.
      const at = Math.min(now, Math.max(now - 700, Number(p.at) || now));
      this.stop(Math.max(at, this.spinAt + STOP2));
      return true;
    }
    if (cmd === "done" || cmd === "skip") {
      if (this.phase !== "task" || !this.outcome) throw new Error("INVALID");
      const target = this.outcome.card.target,
        doer = target === "puller" ? this.turn : partner;
      // The other person vouches that the task was done; the doer may skip.
      if (target !== "both" && seat !== (cmd === "done" ? 1 - doer : doer))
        throw new Error("NOT_YOUR_TURN");
      if (cmd === "done") {
        this.sweet++;
        this.coins++;
      } else {
        this.skipped++;
        this.coins = Math.max(0, this.coins - 2);
      }
      this.advance();
      return true;
    }
    throw new Error("INVALID");
  }
  shift(ms: number) {
    super.shift(ms);
    this.spinAt += ms;
  }
}
