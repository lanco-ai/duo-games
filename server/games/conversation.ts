import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import {
  commitment,
  commit,
  committedView,
  type Commitment,
} from "../../shared/commit-reveal";
import { normalize, text, integer } from "../../shared/text";
import { shuffled } from "../../shared/rng";
import { questions, type Question } from "../../shared/content/questions";
import { radarStats } from "../../shared/games/radar";
export class MindMeld extends BaseEngine {
  pending = commitment<string>();
  history: [string, string][] = [];
  agrees: [boolean, boolean] = [false, false];
  deadline = 0;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("mind-meld", run, o, seed, at, c);
    this.deadline = Number(o.seconds) ? at + Number(o.seconds) * 1000 : 0;
  }
  view(seat: Seat) {
    return {
      round: this.history.length,
      topic: this.options.topic || "自由联想",
      history: this.history,
      ...committedView(this.pending, seat),
      agrees: this.agrees,
      deadline: this.deadline,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw new Error("INVALID");
    if (cmd === "submit") {
      if (
        this.history.length >= 10 ||
        p?.round !== this.history.length ||
        this.pending.revealAt
      )
        throw new Error("STALE");
      const word = text(p.word, 16),
        norm = normalize(word);
      if (
        !(
          /^[\p{Script=Han}]{1,8}$/u.test(norm) || /^[a-z]{1,16}$/.test(norm)
        ) ||
        this.history.flat().some((w) => normalize(w) === norm)
      )
        throw new Error("INVALID");
      if (this.deadline && now > this.deadline + 400)
        throw new Error("INVALID");
      commit(this.pending, seat, word, now);
      this.agrees = [false, false];
      return true;
    }
    if (
      cmd === "finish" &&
      this.history.length === 10 &&
      !this.pending.revealAt
    ) {
      this.complete(false);
      return true;
    }
    if (cmd === "agree") {
      if (
        !this.history.length ||
        p?.round !== this.history.length ||
        this.pending.answers.some((a) => a !== null)
      )
        throw new Error("INVALID");
      this.agrees[seat] = true;
      if (this.agrees.every(Boolean)) this.complete(true);
      return true;
    }
    throw new Error("INVALID");
  }
  radar(success = false) {
    return radarStats(
      this.history.map((pair, i) => ({
        tag: String(this.options.topic || "自由联想"),
        points:
          normalize(pair[0]) === normalize(pair[1]) ||
          (success && i === this.history.length - 1)
            ? 1
            : 0,
        max: 1,
      })),
    );
  }
  complete(success: boolean) {
    this.done(
      success ? "心有灵犀" : "差一点点，但聊得很开心",
      this.history.length + " 轮",
      [
        success
          ? "两个不同的念头，终于走到了一起。"
          : "每一步联想，都是靠近彼此的路。",
      ],
      {
        rounds: this.history.length,
        success: success ? 1 : 0,
        ...this.radar(success),
      },
    );
    this.ctx.gallery("chain", "我们的灵犀链", {
      history: this.history,
      success,
    });
  }
  tick(now: number) {
    if (this.result) return false;
    if (this.pending.revealAt && now >= this.pending.revealAt) {
      const pair = this.pending.answers as [string, string];
      this.history.push(pair);
      this.pending = commitment();
      this.agrees = [false, false];
      this.deadline = Number(this.options.seconds)
        ? now + Number(this.options.seconds) * 1000
        : 0;
      if (normalize(pair[0]) === normalize(pair[1])) this.complete(true);
      else if (this.history.length >= 10) this.deadline = 0;
      return true;
    }
    if (this.deadline && now > this.deadline + 400 && !this.pending.revealAt) {
      // A missing word remains visibly missing, never silently invent an answer.
      this.done(
        "这一轮先歇一歇",
        this.history.length + " 轮",
        ["没有在限时内写完，换个词再来一次吧。"],
        { rounds: this.history.length, success: 0, ...this.radar() },
      );
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    if (this.deadline) this.deadline += ms;
    if (this.pending.revealAt) this.pending.revealAt += ms;
  }
}
export type Answer = number | string | number[];
export function answerValid(q: Question, a: any): a is Answer {
  if (q.type === "choice") return Number.isInteger(a) && a >= 0 && a < 4;
  if (q.type === "slider") return Number.isInteger(a) && a >= 0 && a <= 100;
  if (q.type === "rank")
    return (
      Array.isArray(a) &&
      a.length === 4 &&
      new Set(a).size === 4 &&
      a.every((n) => Number.isInteger(n) && n >= 0 && n < 4)
    );
  return (
    typeof a === "string" &&
    a.trim().length > 0 &&
    [...a].length <= 120 &&
    !/[\u0000-\u001f]/.test(a)
  );
}
export function score(q: Question, a: Answer, b: Answer) {
  if (q.type === "choice") return a === b ? 10 : 0;
  if (q.type === "slider") {
    const d = Math.abs(Number(a) - Number(b));
    return d <= 15 ? 10 : d <= 30 ? 5 : 0;
  }
  if (q.type === "rank")
    return (a as number[]).reduce(
      (sum, x, i) => sum + (x === (b as number[])[i] ? 2.5 : 0),
      0,
    );
  return 0;
}
export class KnowMe extends BaseEngine {
  order: Question[];
  idx = 0;
  pending: Commitment<Answer> = commitment();
  phase: "answer" | "grade" | "revealed" = "answer";
  points = 0;
  deadline = 0;
  history: {
    question: Question;
    answers: Answer[];
    score: number;
    hero: Seat;
  }[] = [];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("know-me", run, o, seed, at, c);
    const custom = c.custom
      .filter((x) => x.kind === "question")
      .map(
        (x) =>
          ({
            ...x.data,
            id: x.id,
            cat: "我们的题",
            type: x.data.options?.length ? "choice" : "text",
          }) as Question,
      );
    const pool = [
      ...questions.filter((q) => (o.categories as string[]).includes(q.cat)),
      ...custom,
    ].filter((q) => o.mode !== "blind" || q.type === "choice");
    const unused = pool.filter((q) => !c.seen.includes(q.id));
    this.order = shuffled(o.unused ? unused : pool, seed).slice(
      0,
      Number(o.count),
    );
    if (!this.order.length) throw new Error("INVALID");
    if (o.mode === "blind") this.deadline = at + 5000;
  }
  view(seat: Seat, now = Date.now()) {
    const visible = committedView(this.pending, seat);
    if (this.options.mode === "blind" && now < this.deadline)
      visible.answers = null;
    return {
      idx: this.idx,
      total: this.order.length,
      hero: this.idx % 2,
      question: this.order[this.idx],
      phase: this.phase,
      ...visible,
      mode: this.options.mode,
      deadline: this.deadline,
      points: this.points,
      history: this.history.slice(-3),
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (p?.idx !== this.idx || this.result) throw new Error("STALE");
    if (cmd === "submit") {
      if (
        this.phase !== "answer" ||
        !answerValid(this.order[this.idx], p.answer) ||
        (this.options.mode === "blind" && now >= this.deadline)
      )
        throw new Error("INVALID");
      commit(this.pending, seat, p.answer, now);
      if (this.options.mode === "blind" && this.pending.revealAt)
        this.pending.revealAt = this.deadline;
      return true;
    }
    if (cmd === "grade") {
      if (
        this.phase !== "grade" ||
        seat !== this.idx % 2 ||
        ![0, 5, 10].includes(p.score)
      )
        throw new Error("INVALID");
      this.record(p.score);
      return true;
    }
    if (cmd === "next") {
      if (this.phase !== "revealed") throw new Error("INVALID");
      if (this.idx + 1 === this.order.length) {
        const percent = Math.round(
          (this.points / (this.order.length * 10)) * 100,
        );
        const surprises = this.history
          .filter((x) => x.score < 10)
          .sort(
            (a, b) =>
              a.score - b.score ||
              (b.question.type === "slider"
                ? Math.abs(Number(b.answers[0]) - Number(b.answers[1]))
                : 0) -
                (a.question.type === "slider"
                  ? Math.abs(Number(a.answers[0]) - Number(a.answers[1]))
                  : 0),
          )
          .slice(0, 3);
        this.done(
          "你们的默契指数",
          percent + "%",
          surprises.length
            ? surprises.map((x) => x.question.text + " · " + x.score + "/10")
            : ["每一道都猜中了，今天也很懂彼此。"],
          {
            points: this.points,
            total: this.order.length,
            percent,
            ...radarStats(
              this.history.map((h) => ({
                tag: h.question.cat,
                points: h.score,
                max: 10,
              })),
            ),
          },
        );
      } else {
        this.idx++;
        this.phase = "answer";
        this.pending = commitment();
        if (this.options.mode === "blind") this.deadline = now + 5000;
      }
      return true;
    }
    throw new Error("INVALID");
  }
  record(points: number) {
    this.points += points;
    this.history.push({
      question: this.order[this.idx],
      answers: this.pending.answers as Answer[],
      score: points,
      hero: (this.idx % 2) as Seat,
    });
    this.ctx.seenQuestion(this.order[this.idx].id);
    this.phase = "revealed";
  }
  tick(now: number) {
    if (
      this.options.mode === "blind" &&
      this.phase === "answer" &&
      now >= this.deadline
    ) {
      const a = this.pending.answers;
      this.pending.revealAt = this.deadline;
      this.record(
        a[0] === null || a[1] === null
          ? 0
          : score(this.order[this.idx], a[0], a[1]),
      );
      return true;
    }
    if (
      this.phase === "answer" &&
      this.pending.revealAt &&
      now >= this.pending.revealAt
    ) {
      const q = this.order[this.idx];
      if (q.type === "text") this.phase = "grade";
      else this.record(score(q, ...(this.pending.answers as [Answer, Answer])));
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    if (this.pending.revealAt) this.pending.revealAt += ms;
    if (this.deadline) this.deadline += ms;
  }
}
