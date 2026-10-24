import { BaseEngine } from "./base";
import { words, type Word } from "../../shared/content/words";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import { shuffled } from "../../shared/rng";
import { integer, text, normalize, near } from "../../shared/text";
export interface Stroke {
  id: string;
  color: string;
  size: number;
  points: number[];
  at: number;
  times: number[];
}
export const inks = [
  "#292B3D",
  "#F05267",
  "#F5B83D",
  "#46A77C",
  "#4099DD",
  "#9270C4",
  "#F18B48",
  "#FFFFFF",
];
export class DrawGuess extends BaseEngine {
  round = 0;
  drawer: Seat = 0;
  phase: "choosing" | "drawing" | "reveal" = "choosing";
  deadline: number;
  choice: Word[] = [];
  answer: Word | null = null;
  strokes: Stroke[] = [];
  revision = 0;
  guesses: { text: string; near: boolean; correct: boolean }[] = [];
  score = 0;
  started = 0;
  roundPoints = 0;
  roundTime = 0;
  fastest: { word: string; time: number } | null = null;
  bytes = 0;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("draw-guess", run, o, seed, at, c);
    this.deadline = at + 10000;
    if (
      (o.libraries as string[]).length === 1 &&
      (o.libraries as string[])[0] === "我们的回忆" &&
      [0, 1].some(
        (seat) =>
          c.custom.filter((x) => x.kind === "word" && x.author === seat)
            .length < 3,
      )
    )
      throw new Error("NEED_WORDS");
    this.choices();
  }
  choices() {
    const own = this.ctx.custom
      .filter((x) => x.kind === "word" && x.author === this.drawer)
      .map(
        (x) =>
          ({
            w: x.data.word,
            alt: [],
            cat: "我们的回忆",
            lvl: 2,
            library: "我们的回忆",
          }) as Word,
      );
    let pool = [...words, ...own].filter((w) =>
      (this.options.libraries as string[]).includes(w.library),
    );
    if (!pool.length) throw new Error("NEED_WORDS");
    const picked: Word[] = [];
    for (let lvl = 1; lvl <= 3; lvl++) {
      const available = pool.filter(
        (w) => w.lvl === lvl && !picked.some((p) => p.w === w.w),
      );
      const fallback = pool.filter((w) => !picked.some((p) => p.w === w.w));
      picked.push({
        ...shuffled(
          available.length ? available : fallback.length ? fallback : pool,
          this.seed + this.round * 3 + lvl,
        )[0],
        lvl,
      });
    }
    this.choice = picked;
  }
  view(seat: Seat, now: number) {
    const revealed = this.phase === "reveal",
      remaining = this.deadline - now;
    return {
      round: this.round,
      total: this.options.rounds,
      drawer: this.drawer,
      phase: this.phase,
      deadline: this.deadline,
      started: this.started,
      choices:
        seat === this.drawer && this.phase === "choosing"
          ? this.choice.map(({ w, lvl }) => ({ w, lvl }))
          : null,
      answer: seat === this.drawer || revealed ? this.answer?.w : null,
      letters:
        this.answer &&
        this.phase === "drawing" &&
        remaining <= Number(this.options.seconds) * 500
          ? [...this.answer.w].length
          : null,
      category:
        this.answer &&
        this.phase === "drawing" &&
        remaining <= Number(this.options.seconds) * 250
          ? this.answer.cat
          : null,
      guesses: this.guesses.slice(-12),
      score: this.score,
      roundPoints: this.roundPoints,
      roundTime: this.roundTime,
      revision: this.revision,
    };
  }
  choose(index: number, now: number) {
    this.answer = this.choice[index];
    this.phase = "drawing";
    this.started = now;
    this.deadline = now + Number(this.options.seconds) * 1000;
  }
  endRound(now: number, correct: boolean) {
    if (this.phase !== "drawing") return;
    this.phase = "reveal";
    this.roundTime = Math.max(0, (now - this.started) / 1000);
    const time = Number(this.options.seconds),
      left = Math.max(0, this.deadline - now) / 1000;
    this.roundPoints = correct
      ? Math.round(this.answer!.lvl * (1 + left / time) * 2) / 2
      : 0;
    this.score += this.roundPoints;
    if (correct && (!this.fastest || this.roundTime < this.fastest.time))
      this.fastest = { word: this.answer!.w, time: this.roundTime };
    this.ctx.gallery("drawing", this.answer!.w, {
      strokes: this.strokes,
      word: this.answer!.w,
      drawer: this.drawer,
      seconds: this.roundTime,
      points: this.roundPoints,
    });
    this.deadline = now + 3000;
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (p?.round !== this.round || this.result) throw new Error("STALE");
    if (cmd === "choose") {
      if (this.phase !== "choosing" || seat !== this.drawer)
        throw new Error("INVALID");
      this.choose(integer(p.index, 0, 2), now);
      return true;
    }
    if (cmd === "guess") {
      if (
        this.phase !== "drawing" ||
        seat === this.drawer ||
        now > this.deadline + 400
      )
        throw new Error("INVALID");
      const guess = text(p.text, 30),
        norm = normalize(guess),
        targets = [this.answer!.w, ...this.answer!.alt].map(normalize);
      const correct = targets.includes(norm);
      this.guesses.push({
        text: guess,
        near: !correct && targets.some((w) => near(norm, w)),
        correct,
      });
      this.guesses = this.guesses.slice(-20);
      if (correct) this.endRound(now, true);
      return true;
    }
    if (cmd === "undo" || cmd === "clear") {
      if (seat !== this.drawer || this.phase !== "drawing")
        throw new Error("INVALID");
      if (cmd === "undo") this.strokes.pop();
      else this.strokes = [];
      this.bytes = Buffer.byteLength(JSON.stringify(this.strokes));
      this.revision++;
      this.ctx.emit("ink", {
        round: this.round,
        op: cmd,
        revision: this.revision,
      });
      return true;
    }
    throw new Error("INVALID");
  }
  stream(seat: Seat, kind: string, p: any, now: number) {
    if (
      kind !== "ink" ||
      p?.round !== this.round ||
      seat !== this.drawer ||
      this.phase !== "drawing" ||
      now > this.deadline + 400
    )
      return;
    const sid = text(p.id, 64);
    let event: any;
    if (p.op === "start") {
      if (this.strokes.some((s) => s.id === sid)) return;
      if (
        this.strokes.length >= 1024 ||
        this.bytes > 2 * 1024 * 1024 ||
        !inks.includes(p.color) ||
        ![4, 10, 22].includes(p.size)
      )
        throw new Error("INVALID");
      const stroke = {
        id: sid,
        color: p.color,
        size: p.size,
        points: [],
        at: now,
        times: [],
      };
      this.strokes.push(stroke);
      event = { op: "start", stroke };
      this.bytes += 160;
    } else {
      const stroke = this.strokes.at(-1);
      if (!stroke || stroke.id !== sid) return;
      if (p.op === "points") {
        if (
          !Array.isArray(p.points) ||
          !p.points.length ||
          p.points.length % 2 ||
          p.points.length > 128 ||
          p.points.some(
            (v: unknown) =>
              !Number.isInteger(v) || Number(v) < 0 || Number(v) > 1000,
          )
        )
          throw new Error("INVALID");
        if (p.offset !== stroke.points.length) return;
        const size =
          Buffer.byteLength(JSON.stringify(p.points)) + p.points.length * 8;
        if (this.bytes + size > 2 * 1024 * 1024)
          throw new Error("RATE_LIMITED");
        stroke.points.push(...p.points);
        stroke.times.push(...Array(p.points.length / 2).fill(now));
        this.bytes += size;
        event = {
          op: "points",
          id: sid,
          points: p.points,
          offset: p.offset,
          at: now,
        };
      } else if (p.op === "end") event = { op: "end", id: sid };
      else throw new Error("INVALID");
    }
    this.revision++;
    this.ctx.emit("ink", {
      ...event,
      round: this.round,
      revision: this.revision,
    });
  }
  data(_seat: Seat, kind: string) {
    if (kind !== "drawing") throw new Error("INVALID");
    return {
      round: this.round,
      revision: this.revision,
      strokes: this.strokes,
    };
  }
  tick(now: number) {
    if (this.result) return false;
    if (this.phase === "choosing" && now >= this.deadline) {
      this.choose(1, now);
      return true;
    }
    if (this.phase === "drawing" && now > this.deadline + 400) {
      this.endRound(now, false);
      return true;
    }
    if (this.phase === "reveal" && now >= this.deadline) {
      if (this.round + 1 >= Number(this.options.rounds)) {
        const title =
          this.score >= 24
            ? "心意相通"
            : this.score >= 15
              ? "默契不错"
              : this.score >= 8
                ? "继续加油"
                : "灵魂画手";
        this.done(
          title,
          this.score + " 分",
          [
            this.fastest
              ? `最快猜中：「${this.fastest.word}」${this.fastest.time.toFixed(1)} 秒`
              : "画得开心，就是两个人的好作品。",
          ],
          { score: this.score, rounds: this.round + 1 },
        );
      } else {
        this.round++;
        this.drawer = (this.round % 2) as Seat;
        this.phase = "choosing";
        this.deadline = now + 10000;
        this.answer = null;
        this.strokes = [];
        this.guesses = [];
        this.bytes = 0;
        this.roundPoints = 0;
        this.revision++;
        this.choices();
      }
      return true;
    }
    // Hint transitions must be pushed even if neither player sends an action.
    const hint =
      this.phase === "drawing"
        ? now > this.deadline - Number(this.options.seconds) * 250
          ? 2
          : now > this.deadline - Number(this.options.seconds) * 500
            ? 1
            : 0
        : 0;
    if (hint !== this.hint) {
      this.hint = hint;
      return true;
    }
    return false;
  }
  hint = 0;
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
    if (this.started) this.started += ms;
  }
}
