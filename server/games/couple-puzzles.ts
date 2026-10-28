import { BaseEngine } from "./base";
import { shuffled, mulberry32 } from "../../shared/rng";
import {
  survivalLevels,
  differenceObjects,
  differenceScenes,
  ludoTasks,
} from "../../shared/games/couple-content";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
import { integer } from "../../shared/text";

export { Survival } from "./survival";

export { SpotDifference } from "./difference";

export class CoupleLudo extends BaseEngine {
  rand: () => number;
  positions: [number, number] = [-1, -1];
  turn: Seat = 0;
  dice = 0;
  task = "";
  event = "";
  moves = 0;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("couple-ludo", run, o, seed, at, c);
    this.rand = mulberry32(seed);
  }
  view() {
    return {
      positions: this.positions,
      turn: this.turn,
      dice: this.dice,
      task: this.task,
      event: this.event,
      moves: this.moves,
      mode: this.options.mode,
    };
  }
  act(seat: Seat, cmd: string, _p: any, _now: number) {
    if (this.result || seat !== this.turn) throw new Error("NOT_YOUR_TURN");
    if (cmd === "continue" && this.task) {
      this.task = "";
      this.turn = (1 - this.turn) as Seat;
      return true;
    }
    if (cmd !== "roll" || this.task) throw new Error("INVALID");
    this.dice = Math.floor(this.rand() * 6) + 1;
    this.moves++;
    let pos = this.positions[seat] < 0 ? 0 : this.positions[seat] + this.dice;
    if (pos >= 53) {
      this.positions[seat] = 53;
      this.done(
        "抵达终点",
        `玩家 ${seat + 1} 获胜`,
        [`一起完成 ${this.moves} 次投掷`],
        { winner: seat, moves: this.moves },
      );
      return true;
    }
    const events = ["❤️", "💬", "⚡", "💣"] as const;
    this.event = events[pos % 4];
    if (this.event === "⚡" && pos < 44) pos += 4;
    this.positions[seat] = pos;
    const other = (1 - seat) as Seat;
    if (pos < 48 && this.positions[other] === pos) {
      this.positions[other] = -1;
      this.event = "💣";
    }
    const pools = ludoTasks[String(this.options.mode)] || ludoTasks.pure;
    const pool =
      this.event === "❤️"
        ? pools[0]
        : this.event === "💬"
          ? pools[1]
          : this.event === "💣"
            ? ludoTasks.fun[0]
            : [];
    this.task = pool.length ? pool[Math.floor(this.rand() * pool.length)] : "";
    if (!this.task) this.turn = other;
    return true;
  }
}

export { CoupleJump } from "./jump";
