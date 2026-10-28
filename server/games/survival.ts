import { BaseEngine } from "./base";
import { shuffled } from "../../shared/rng";
import { text, integer, normalize } from "../../shared/text";
import {
  survivalChapters,
  survivalQuestions,
} from "../../shared/content/survival";
import { unlockedLevel, unlockNext } from "../../shared/games/progress";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
export class Survival extends BaseEngine {
  chapter: number;
  order: number[];
  idx = 0;
  lives = 3;
  points = 0;
  hints = 3;
  highlight: number | null = null;
  deadline: number;
  phase: "choose" | "rate" | "reveal" | "revive" = "choose";
  answers: [string | null, string | null] = [null, null];
  history: {
    prompt: string;
    wanted: string;
    answer: string;
    points: number;
  }[] = [];
  revived = false;
  appeal = "";
  feedback = "";
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("survival", run, o, seed, at, c);
    this.chapter = Math.max(
      0,
      Math.min(4, unlockedLevel(c, this.id, 5) - 1, Number(o.chapter || 1) - 1),
    );
    this.order = shuffled(
      survivalQuestions
        .map((_, i) => i)
        .filter((i) => survivalQuestions[i].chapter === this.chapter),
      seed,
    ).slice(0, 5);
    this.deadline = at + 40000;
  }
  get level() {
    return survivalQuestions[this.order[this.idx]];
  }
  get asker() {
    return (this.idx % 2) as Seat;
  }
  view(seat: Seat) {
    const reveal = this.phase !== "choose";
    return {
      chapter: this.chapter,
      chapterName: survivalChapters[this.chapter],
      idx: this.idx,
      total: 5,
      lives: this.lives,
      points: this.points,
      hints: this.hints,
      asker: this.asker,
      scene: this.level.scene,
      prompt: this.level.prompt,
      options: this.level.options,
      objects: this.level.objects,
      highlight: this.highlight,
      phase: this.phase,
      deadline: this.deadline,
      own: this.answers[seat],
      submitted: this.answers.map((x) => x !== null),
      answers: reveal ? this.answers : null,
      history: this.history,
      appeal: this.appeal,
      revived: this.revived,
      feedback: this.feedback,
    };
  }
  choice(p: any, max: number) {
    return p?.text !== undefined
      ? text(p.text, max)
      : this.level.options[integer(p?.choice, 0, 3)];
  }
  reveal(now: number) {
    const wanted = this.answers[this.asker],
      answer = this.answers[(1 - this.asker) as Seat];
    if (wanted && answer && normalize(wanted) === normalize(answer)) {
      this.score(10, now);
    } else {
      this.phase = "rate";
      this.deadline = now + 15000;
      this.feedback = "其实我想听的是……请提问者回应";
    }
  }
  score(value: number, now: number) {
    this.points += value;
    if (value < 0) this.lives--;
    this.history.push({
      prompt: this.level.prompt,
      wanted: this.answers[this.asker] || "未选择",
      answer: this.answers[(1 - this.asker) as Seat] || "未作答",
      points: value,
    });
    this.feedback =
      value > 0
        ? "求生成功，原来你这么懂我！"
        : value < 0
          ? "记住这个小心愿，下次更懂你"
          : "没关系，我们又多了解了一点";
    if (!this.lives) {
      if (this.revived) this.finish();
      else {
        this.phase = "revive";
        this.deadline = now + 40000;
      }
      return;
    }
    this.phase = "reveal";
    this.deadline = now + 15000;
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || p?.idx !== this.idx) throw Error("STALE");
    if (this.phase === "choose" && now >= this.deadline) {
      return this.tick(now);
    }
    if (cmd === "hint") {
      if (
        seat !== this.asker ||
        this.phase !== "choose" ||
        !this.hints ||
        this.highlight !== null
      )
        throw Error("INVALID");
      this.highlight = integer(p?.item, 0, this.level.objects.length - 1);
      this.hints--;
      return true;
    }
    if (cmd === "submit") {
      if (this.phase !== "choose" || this.answers[seat] !== null)
        throw Error("INVALID");
      this.answers[seat] = this.choice(p, seat === this.asker ? 20 : 30);
      if (this.answers.every((x) => x !== null)) this.reveal(now);
      return true;
    }
    if (cmd === "rate") {
      if (this.phase !== "rate" || seat !== this.asker)
        throw Error("NOT_YOUR_TURN");
      const value = integer(p?.value, -1, 1);
      this.score(value * 10, now);
      return true;
    }
    if (cmd === "appeal") {
      if (this.phase !== "revive" || seat === this.asker || this.appeal)
        throw Error("INVALID");
      this.appeal = text(p?.text, 60);
      return true;
    }
    if (cmd === "revive") {
      if (
        this.phase !== "revive" ||
        seat !== this.asker ||
        !this.appeal ||
        typeof p?.accept !== "boolean"
      )
        throw Error("INVALID");
      if (p.accept) {
        this.revived = true;
        this.lives = 1;
        this.phase = "reveal";
        this.deadline = now + 15000;
      } else this.finish();
      return true;
    }
    if (cmd === "next") {
      if (this.phase !== "reveal") throw Error("INVALID");
      this.next(now);
      return true;
    }
    throw Error("INVALID");
  }
  next(now: number) {
    if (this.idx === 4) {
      this.finish();
      return;
    }
    this.idx++;
    this.answers = [null, null];
    this.phase = "choose";
    this.highlight = null;
    this.feedback = "";
    this.deadline = now + 40000;
  }
  finish() {
    const stars = this.lives;
    this.done(
      "我们的求生指数",
      Math.round((this.history.filter((h) => h.points > 0).length / 5) * 100) +
        "%",
      [
        survivalChapters[this.chapter] + " · " + "★".repeat(stars),
        ...this.history.slice(0, 3).map((h) => "TA想听：" + h.wanted),
      ],
      {
        points: this.points,
        stars,
        chapter: this.chapter + 1,
        passed: this.history.length,
      },
    );
    if (stars) unlockNext(this.ctx, this.id, this.chapter + 1, 5);
    this.ctx.gallery("survival", "TA最想听的三句话", {
      chapter: survivalChapters[this.chapter],
      stars,
      lines: this.history.slice(0, 3).map((h) => h.wanted),
    });
  }
  tick(now: number) {
    if (this.result || now < this.deadline) return false;
    if (this.phase === "choose") this.reveal(now);
    else if (this.phase === "rate") this.score(0, now);
    else if (this.phase === "reveal") this.next(now);
    else this.finish();
    return true;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
  }
}
