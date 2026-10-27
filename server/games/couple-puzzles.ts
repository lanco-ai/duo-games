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

export class Survival extends BaseEngine {
  order: number[];
  idx = 0;
  lives = 3;
  points = 0;
  clueFound = false;
  feedback = "";
  hints = 0;
  dangerAt = 0;
  endAt = 0;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("survival", run, o, seed, at, c);
    const all = survivalLevels.map((_, i) => i);
    this.order = shuffled(
      o.mode === "search"
        ? all.filter((i) => i % 2)
        : o.mode === "quiz"
          ? all.filter((i) => i % 2 === 0)
          : all,
      seed,
    );
  }
  get level() {
    return survivalLevels[this.order[this.idx]];
  }
  get searching() {
    return (
      this.options.mode === "search" ||
      (this.options.mode === "mixed" && this.order[this.idx] % 2 === 1)
    );
  }
  view() {
    return {
      idx: this.idx,
      total: this.order.length,
      lives: this.lives,
      points: this.points,
      scene: this.level.scene,
      prompt: this.level.prompt,
      options: this.level.options,
      searching: this.searching,
      clueFound: this.clueFound,
      feedback: this.feedback,
      dangerAt: this.dangerAt,
      ending: !!this.endAt,
      hint: this.hints
        ? `仔细看看场景中的${["口红", "手机", "礼物盒", "纸条"][this.level.clue]}。`
        : null,
    };
  }
  act(_seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || this.endAt) throw new Error("INVALID");
    if (cmd === "hint") {
      this.hints++;
      return true;
    }
    if (cmd === "clue") {
      if (!this.searching || this.clueFound) throw new Error("INVALID");
      const id = integer(p?.id, 0, 3);
      this.clueFound = id === this.level.clue;
      this.feedback = this.clueFound
        ? "找到线索了，再选一个温柔的回答。"
        : "这里好像没有线索，再找找。";
      return true;
    }
    if (cmd === "answer") {
      if (p?.idx !== this.idx || (this.searching && !this.clueFound))
        throw new Error("INVALID");
      const choice = integer(p?.choice, 0, 2),
        score = this.level.scores[choice];
      if (score === 0) {
        this.feedback = "有点危险，再想想怎样更体贴。";
        return true;
      }
      if (score < 0) {
        this.lives--;
        this.points += score;
        this.dangerAt = now;
        this.feedback = "说错话啦，失去一颗心。";
        if (this.lives === 0) this.endAt = now + 1000;
        return true;
      }
      this.points += score;
      this.idx++;
      this.clueFound = false;
      this.hints = 0;
      this.feedback = "回答得真贴心！";
      if (this.idx >= this.order.length) {
        this.idx = this.order.length - 1;
        this.done(
          "求生欲满分",
          `${this.points} 分`,
          ["你们一起度过了所有小考验。"],
          { points: this.points, passed: this.order.length },
        );
      }
      return true;
    }
    throw new Error("INVALID");
  }
  tick(now: number) {
    if (this.endAt && now >= this.endAt && !this.result) {
      this.done(
        "求生欲告急",
        `${this.points} 分`,
        ["换个温柔的回答，再挑战一次。"],
        { points: this.points, passed: this.idx },
      );
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    if (this.dangerAt) this.dangerAt += ms;
    if (this.endAt) this.endAt += ms;
  }
}

export class SpotDifference extends BaseEngine {
  selected: number[];
  found: number[] = [];
  deadline: number;
  misses = 0;
  lastMiss: { x: number; y: number; at: number } | null = null;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("spot-difference", run, o, seed, at, c);
    this.selected = shuffled(
      differenceObjects.map((x) => x.id),
      seed,
    ).slice(0, 5);
    this.deadline = at + 60000;
  }
  view() {
    return {
      scene: differenceScenes[Number(this.options.scene)],
      sceneId: Number(this.options.scene),
      differences: this.selected,
      found: this.found,
      deadline: this.deadline,
      misses: this.misses,
      lastMiss: this.lastMiss,
    };
  }
  act(_seat: Seat, cmd: string, p: any, now: number) {
    if (cmd !== "tap" || this.result || now >= this.deadline)
      throw new Error("INVALID");
    if (
      typeof p?.x !== "number" ||
      typeof p?.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < 0 ||
      p.x > 100 ||
      p.y < 0 ||
      p.y > 100
    )
      throw new Error("INVALID");
    const hit = differenceObjects.find(
      (x) =>
        this.selected.includes(x.id) && Math.hypot(x.x - p.x, x.y - p.y) <= 9,
    );
    if (hit) {
      if (this.found.includes(hit.id)) return false;
      this.found.push(hit.id);
      if (this.found.length === 5)
        this.done("找到了全部不同", "5 / 5", ["你们的眼力真默契！"], {
          found: 5,
          misses: this.misses,
        });
    } else {
      this.deadline -= 3000;
      this.misses++;
      this.lastMiss = { x: p.x, y: p.y, at: now };
      if (now >= this.deadline) this.end();
    }
    return true;
  }
  end() {
    this.done("时间到", `${this.found.length} / 5`, ["再仔细找一找吧。"], {
      found: this.found.length,
      misses: this.misses,
    });
  }
  tick(now: number) {
    if (!this.result && now >= this.deadline) {
      this.end();
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
    if (this.lastMiss) this.lastMiss.at += ms;
  }
}

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

export class CoupleJump extends BaseEngine {
  rand: () => number;
  step = 0;
  points = 0;
  combo = 0;
  target = 0;
  charges: [number | null, number | null] = [null, null];
  started: [number | null, number | null] = [null, null];
  last: any = null;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("couple-jump", run, o, seed, at, c);
    this.rand = mulberry32(seed);
    this.nextTarget();
  }
  nextTarget() {
    this.target = 500 + Math.floor(this.rand() * 900);
  }
  view() {
    return {
      step: this.step,
      points: this.points,
      combo: this.combo,
      target: this.target,
      mode: this.options.mode,
      charging: this.started.map((x) => x !== null),
      released: this.charges.map((x) => x !== null),
      last: this.last,
    };
  }
  act(seat: Seat, cmd: string, _p: any, now: number) {
    if (this.result) throw new Error("INVALID");
    if (this.options.mode === "relay" && seat !== this.step % 2)
      throw new Error("NOT_YOUR_TURN");
    if (cmd === "press") {
      if (this.started[seat] !== null || this.charges[seat] !== null)
        throw new Error("INVALID");
      this.started[seat] = now;
      return true;
    }
    if (cmd === "release") {
      if (this.started[seat] === null) throw new Error("INVALID");
      this.charges[seat] = Math.min(
        2200,
        Math.max(0, now - this.started[seat]!),
      );
      this.started[seat] = null;
      if (this.options.mode === "relay")
        this.resolveJump(this.charges[seat]!, false);
      else if (this.charges.every((x) => x !== null)) {
        const [a, b] = this.charges as [number, number],
          perfect = Math.abs(a - b) < 150;
        this.resolveJump((a + b) / 2, perfect, Math.abs(a - b));
      }
      return true;
    }
    throw new Error("INVALID");
  }
  resolveJump(duration: number, perfect: boolean, diff = 0) {
    const landed = perfect || Math.abs(duration - this.target) <= 240;
    const center = perfect || Math.abs(duration - this.target) <= 65;
    this.last = {
      landed,
      perfect,
      center,
      duration,
      target: this.target,
      diff,
    };
    this.charges = [null, null];
    this.started = [null, null];
    if (!landed || diff > 800) {
      this.done(
        "旅程暂时结束",
        `${this.points} 分`,
        [`一起跳过 ${this.step} 个平台`],
        { score: this.points, steps: this.step },
      );
      return;
    }
    this.step++;
    this.combo = center ? this.combo + 1 : 0;
    this.points += center ? 2 : 1;
    this.nextTarget();
  }
  shift(ms: number) {
    super.shift(ms);
    this.started = this.started.map((x) => (x === null ? null : x + ms)) as [
      number | null,
      number | null,
    ];
  }
}
