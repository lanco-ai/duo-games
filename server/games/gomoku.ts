import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Consent } from "../../shared/consent";
import { respond } from "../../shared/consent";
import { integer } from "../../shared/text";
import { mulberry32 } from "../../shared/rng";
export function winningLine(board: number[], x: number, y: number, seat: Seat) {
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]) {
    const cells = [y * 15 + x];
    for (const sign of [-1, 1])
      for (let n = 1; n < 15; n++) {
        const nx = x + dx * n * sign,
          ny = y + dy * n * sign;
        if (
          nx < 0 ||
          nx >= 15 ||
          ny < 0 ||
          ny >= 15 ||
          board[ny * 15 + nx] !== seat
        )
          break;
        cells.push(ny * 15 + nx);
      }
    if (cells.length >= 5) return cells;
  }
  return [];
}
export class Gomoku extends BaseEngine {
  board = new Array<number>(225).fill(-1);
  moves: { x: number; y: number; seat: Seat }[] = [];
  turn: Seat;
  line: number[] = [];
  pending: Consent<number> | null = null;
  deadline = 0;
  random: () => number;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("gomoku", run, o, seed, at, c);
    this.random = mulberry32(seed);
    this.turn =
      o.first === "房主"
        ? 0
        : o.first === "TA"
          ? 1
          : (Math.floor(this.random() * 2) as Seat);
    this.nextDeadline(at);
  }
  nextDeadline(now: number) {
    this.deadline = Number(this.options.seconds)
      ? now + Number(this.options.seconds) * 1000
      : 0;
  }
  view() {
    return {
      board: this.board,
      turn: this.turn,
      move: this.moves.length,
      last: this.moves.at(-1) || null,
      line: this.line,
      pending: this.pending,
      deadline: this.deadline,
      wager: this.options.wager,
    };
  }
  place(seat: Seat, x: number, y: number, now: number) {
    if (this.turn !== seat) throw new Error("NOT_YOUR_TURN");
    if (this.board[y * 15 + x] !== -1 || this.pending)
      throw new Error("INVALID");
    this.board[y * 15 + x] = seat;
    this.moves.push({ x, y, seat });
    this.line = winningLine(this.board, x, y, seat);
    if (this.line.length) this.end(seat);
    else if (this.moves.length === 225) this.end(-1);
    else {
      this.turn = (1 - seat) as Seat;
      this.nextDeadline(now);
    }
  }
  end(winner: number) {
    this.done(
      winner < 0 ? "势均力敌" : "五子连心",
      winner < 0 ? "和棋" : `玩家 ${winner + 1} 获胜`,
      [
        winner < 0
          ? "这一盘，你们一样厉害。"
          : String(this.options.wager)
            ? "小约定：" + this.options.wager
            : "好棋，下次再来！",
      ],
      { winner, moves: this.moves.length },
    );
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw new Error("INVALID");
    if (cmd === "place") {
      if (this.deadline && now > this.deadline + 400) throw new Error("STALE");
      if (p?.move !== this.moves.length) throw new Error("STALE");
      this.place(seat, integer(p.x, 0, 14), integer(p.y, 0, 14), now);
      return true;
    }
    if (cmd === "undo" || cmd === "draw") {
      if (this.pending) throw new Error("INVALID");
      if (
        cmd === "undo" &&
        (this.moves.at(-1)?.seat !== seat || this.turn === seat)
      )
        throw new Error("INVALID");
      this.pending = { kind: cmd, by: seat, payload: this.moves.length };
      return true;
    }
    if (cmd === "accept" || cmd === "decline") {
      const pending = this.pending;
      respond(pending, seat, cmd === "accept");
      this.pending = null;
      if (cmd === "accept" && pending?.kind === "draw") this.end(-1);
      else if (cmd === "accept" && pending?.kind === "undo") {
        const m = this.moves.pop()!;
        this.board[m.y * 15 + m.x] = -1;
        this.turn = m.seat;
      }
      this.nextDeadline(now);
      return true;
    }
    if (cmd === "cancel") {
      if (this.pending?.by !== seat) throw new Error("INVALID");
      this.pending = null;
      this.nextDeadline(now);
      return true;
    }
    if (cmd === "resign") {
      this.pending = null;
      this.end(1 - seat);
      return true;
    }
    throw new Error("INVALID");
  }
  tick(now: number) {
    if (
      !this.result &&
      !this.pending &&
      this.deadline &&
      now > this.deadline + 400
    ) {
      const empty = this.board.flatMap((v, i) => (v === -1 ? [i] : [])),
        cell = empty[Math.floor(this.random() * empty.length)];
      this.place(this.turn, cell % 15, Math.floor(cell / 15), now);
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    if (this.deadline) this.deadline += ms;
  }
}
