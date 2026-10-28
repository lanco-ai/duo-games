import { BaseEngine } from "./base";
import { mulberry32 } from "../../shared/rng";
import { text, integer, normalize } from "../../shared/text";
import { ludoContent } from "../../shared/content/ludo";
import { ludoBoard, ludoZones } from "../../shared/games/couple-ludo/board";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
type Task = {
  id: string;
  kind: string;
  text: string;
  zone: number;
  mode: string;
};
export class CoupleLudo extends BaseEngine {
  rand: () => number;
  positions: [number, number] = [0, 0];
  turn: Seat = 0;
  dice: number[] = [];
  bank = [0, 0];
  phase = "roll";
  moves = 0;
  task: Task | null = null;
  event = "";
  answer = "";
  checks = [false, false];
  words: [string | null, string | null] = [null, null];
  lastWords: string[] | null = null;
  memories: { seat: Seat; text: string; zone: string }[] = [];
  used = new Set<string>();
  routeRoll: number[] = [];
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
  view(seat: Seat) {
    return {
      positions: this.positions,
      turn: this.turn,
      dice: this.dice,
      bank: this.bank,
      phase: this.phase,
      moves: this.moves,
      task: this.task,
      event: this.event,
      answer: this.answer,
      checks: this.checks,
      ownWord: this.words[seat],
      submitted: this.words.map((w) => w !== null),
      lastWords: this.lastWords,
      memories: this.memories,
      routeRoll: this.routeRoll,
      victory: this.options.victory || "coop",
    };
  }
  roll() {
    return Math.floor(this.rand() * 6) + 1;
  }
  act(seat: Seat, cmd: string, p: any, _now: number) {
    if (this.result) throw Error("INVALID");
    if (cmd === "rate") {
      if (this.phase !== "rate" || seat === this.turn)
        throw Error("NOT_YOUR_TURN");
      this.positions[this.turn] = Math.min(
        35,
        this.positions[this.turn] + integer(p?.hearts, 1, 3),
      );
      this.endTurn();
      return true;
    }
    if (cmd === "confirm") {
      if (
        this.phase !== "challenge" ||
        this.task?.kind === "word" ||
        this.checks[seat]
      )
        throw Error("INVALID");
      this.checks[seat] = true;
      if (this.checks.every(Boolean)) {
        this.positions = this.positions.map((x) => Math.min(35, x + 2)) as [
          number,
          number,
        ];
        this.endTurn();
      }
      return true;
    }
    if (cmd === "word") {
      if (
        this.phase !== "challenge" ||
        this.task?.kind !== "word" ||
        this.words[seat] !== null
      )
        throw Error("INVALID");
      this.words[seat] = text(p?.text, 20);
      if (this.words.every((w) => w !== null)) {
        this.lastWords = this.words as string[];
        if (normalize(this.words[0]!) === normalize(this.words[1]!))
          this.positions = this.positions.map((x) => Math.min(35, x + 2)) as [
            number,
            number,
          ];
        this.endTurn();
      }
      return true;
    }
    if (seat !== this.turn) throw Error("NOT_YOUR_TURN");
    if (cmd === "roll") {
      if (this.phase !== "roll") throw Error("INVALID");
      this.dice = [this.roll(), this.roll()];
      this.moves++;
      this.phase = "choose";
      this.lastWords = null;
      return true;
    }
    if (cmd === "gift") {
      if (this.phase !== "choose") throw Error("INVALID");
      const other = (1 - seat) as Seat;
      this.bank[other] = Math.min(
        24,
        this.bank[other] + this.dice[0] + this.dice[1],
      );
      this.event = "让一步，把两颗骰子送给 TA";
      this.endTurn();
      return true;
    }
    if (cmd === "choose") {
      if (this.phase !== "choose") throw Error("INVALID");
      const index = integer(p?.index, 0, 1);
      this.positions[seat] = Math.min(
        35,
        this.positions[seat] + this.dice[index] + this.bank[seat],
      );
      this.bank[seat] = 0;
      this.arrive();
      return true;
    }
    if (cmd === "answer") {
      if (this.phase !== "truth") throw Error("INVALID");
      this.answer = text(p?.text, 120);
      this.phase = "rate";
      return true;
    }
    if (cmd === "memory") {
      if (this.phase !== "memory") throw Error("INVALID");
      const value = text(p?.text, 120),
        zone = ludoZones[ludoBoard[this.positions[seat]].zone];
      this.memories.push({ seat, text: value, zone });
      this.ctx.journal?.(zone + " · 我们的共同回忆", value, seat);
      this.event = "回忆已记进问答本";
      this.endTurn();
      return true;
    }
    if (cmd === "route") {
      if (this.phase !== "fork" || !["short", "long"].includes(p?.route))
        throw Error("INVALID");
      if (p.route === "short") {
        this.routeRoll = [this.roll(), this.roll()];
        const sum = this.routeRoll[0] + this.routeRoll[1];
        this.positions[seat] = Math.max(
          0,
          Math.min(35, this.positions[seat] + (sum >= 8 ? 4 : -2)),
        );
        this.event = sum >= 8 ? "近路成功，前进四格" : "近路未过，退后两格";
      } else {
        this.positions[seat] = Math.min(35, this.positions[seat] + 1);
        this.event = "沿着远路，稳稳前进一步";
      }
      this.endTurn();
      return true;
    }
    throw Error("INVALID");
  }
  arrive() {
    if (this.checkFinish()) return;
    const cell = ludoBoard[this.positions[this.turn]];
    this.event = ludoZones[cell.zone];
    this.answer = "";
    this.checks = [false, false];
    this.words = [null, null];
    if (cell.kind === "truth" || cell.kind === "challenge") {
      const pool = ludoContent.filter(
        (t) =>
          t.zone === cell.zone &&
          t.mode === (this.options.mode || "pure") &&
          (cell.kind === "truth" ? t.kind === "truth" : t.kind !== "truth") &&
          !this.used.has(t.id),
      );
      if (!pool.length) {
        this.event = "这一区域的故事都聊完了";
        this.endTurn();
        return;
      }
      this.task = pool[Math.floor(this.rand() * pool.length)];
      this.used.add(this.task.id);
      this.phase = cell.kind;
      return;
    }
    this.task = null;
    if (cell.kind === "memory") {
      this.phase = "memory";
      return;
    }
    if (cell.kind === "fork") {
      this.phase = "fork";
      return;
    }
    if (
      cell.kind === "redline" &&
      Math.abs(this.positions[0] - this.positions[1]) > 10
    ) {
      const trailing = this.positions[0] < this.positions[1] ? 0 : 1;
      this.positions[trailing] = Math.min(35, this.positions[trailing] + 3);
      this.event = "红线把落后的 TA 拉近三格";
    }
    this.endTurn();
  }
  checkFinish() {
    const winner = this.positions.findIndex((x) => x >= 35),
      won =
        this.options.victory === "versus"
          ? winner >= 0
          : this.positions.every((x) => x >= 35);
    if (!won) return false;
    const stars = this.moves <= 18 ? 3 : this.moves <= 28 ? 2 : 1;
    this.done(
      this.options.victory === "versus"
        ? "心动棋 · 先到终点"
        : "两个人都抵达承诺",
      this.options.victory === "versus"
        ? `玩家 ${winner + 1} 获胜`
        : "★".repeat(stars),
      [
        `${this.moves} 回合 · 留下 ${this.memories.length} 条共同回忆`,
        "最好的终点，是两个人一起到。",
      ],
      {
        moves: this.moves,
        stars,
        winner: this.options.victory === "versus" ? winner : -1,
      },
    );
    this.ctx.gallery("ludo", "我们的心动路线", {
      stars,
      lines: this.memories.map((m) => m.zone + "：" + m.text),
      positions: this.positions,
      moves: this.moves,
    });
    return true;
  }
  endTurn() {
    if (this.checkFinish()) return;
    const other = (1 - this.turn) as Seat;
    this.turn = this.positions[other] >= 35 ? this.turn : other;
    this.phase = "roll";
    this.task = null;
    this.words = [null, null];
    this.checks = [false, false];
    this.dice = [];
  }
}
