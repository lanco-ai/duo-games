import { BaseEngine } from "./base";
import { shuffled } from "../../shared/rng";
import {
  differenceLevels,
  type SceneObject,
} from "../../shared/games/spot-difference/levels";
import { unlockedLevel, unlockNext } from "../../shared/games/progress";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
export class SpotDifference extends BaseEngine {
  level: number;
  selected: number[];
  modified: SceneObject[];
  found: number[] = [];
  deadline: number;
  misses = 0;
  lastMiss: { x: number; y: number; at: number } | null = null;
  signal: { text: string; at: number } | null = null;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("spot-difference", run, o, seed, at, c);
    this.level = Math.max(
      0,
      Math.min(4, unlockedLevel(c, this.id, 5) - 1, Number(o.scene || 0)),
    );
    const scene = differenceLevels[this.level];
    this.selected = shuffled(
      scene.objects.map((x) => x.id),
      seed,
    ).slice(0, scene.count);
    this.modified = scene.objects.flatMap((object) => {
      const obj = { ...object };
      if (!this.selected.includes(obj.id)) return [obj];
      switch ((obj.id + seed) % 6) {
        case 0:
          obj.color = "#284ddf";
          break;
        case 1:
          return [];
        case 2:
          obj.count = 3;
          break;
        case 3:
          obj.direction = -1;
          break;
        case 4:
          obj.size *= 1.5;
          break;
        case 5:
          obj.pattern = "striped";
      }
      return [obj];
    });
    this.deadline = at + scene.seconds * 1000;
  }
  get scene() {
    return differenceLevels[this.level];
  }
  view(seat: Seat, now = this.startAt) {
    const easy = this.level === 0 || this.options.mode === "easy";
    return {
      level: this.level,
      sceneId: this.level,
      scene: this.scene.name,
      background: this.scene.background,
      mode: easy ? "easy" : "split",
      side: seat === 0 ? "原图" : "修改图",
      objects: seat === 0 ? this.scene.objects : this.modified,
      ...(easy ? { images: [this.scene.objects, this.modified] } : {}),
      found: this.found.map((id) => {
        const o = this.scene.objects.find((o) => o.id === id)!;
        return { id, x: o.x, y: o.y };
      }),
      total: this.scene.count,
      deadline: this.deadline,
      misses: this.misses,
      lastMiss:
        this.lastMiss && now - this.lastMiss.at < 1000 ? this.lastMiss : null,
      signal: this.signal && now - this.signal.at < 2000 ? this.signal : null,
    };
  }
  act(_seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || now >= this.deadline) throw Error("INVALID");
    if (cmd === "signal") {
      if (!["左上角", "桌子上", "有几个", "右边", "下面"].includes(p?.text))
        throw Error("INVALID");
      if (this.signal && now - this.signal.at < 700)
        throw Error("RATE_LIMITED");
      this.signal = { text: p.text, at: now };
      return true;
    }
    if (
      cmd !== "tap" ||
      !Number.isFinite(p?.x) ||
      !Number.isFinite(p?.y) ||
      p.x < 0 ||
      p.x > 100 ||
      p.y < 0 ||
      p.y > 100
    )
      throw Error("INVALID");
    const hit = this.scene.objects.find(
      (o) =>
        this.selected.includes(o.id) && Math.hypot(o.x - p.x, o.y - p.y) <= 7,
    );
    if (hit) {
      if (this.found.includes(hit.id)) return false;
      this.found.push(hit.id);
      if (this.found.length === this.scene.count) this.end(now);
    } else {
      this.deadline -= 3000;
      this.misses++;
      this.lastMiss = { x: p.x, y: p.y, at: now };
      if (now >= this.deadline) this.end(now);
    }
    return true;
  }
  end(now: number) {
    const won = this.found.length === this.scene.count,
      remaining = Math.max(
        0,
        (this.deadline - now) / (this.scene.seconds * 1000),
      ),
      stars = won ? (remaining >= 0.5 ? 3 : remaining >= 0.25 ? 2 : 1) : 0;
    this.done(
      won ? "找到了全部不同" : "时间到",
      `${this.found.length} / ${this.scene.count}`,
      [
        this.scene.name + " · " + "★".repeat(stars),
        "你说的每一个细节，我都有认真听。",
      ],
      {
        found: this.found.length,
        misses: this.misses,
        stars,
        level: this.level + 1,
      },
    );
    if (won) unlockNext(this.ctx, this.id, this.level + 1, 5);
    this.ctx.gallery("difference", this.scene.name + " · 答案揭晓", {
      images: [this.scene.objects, this.modified],
      background: this.scene.background,
      found: this.selected.map((id) =>
        this.scene.objects.find((o) => o.id === id),
      ),
      stars,
    });
  }
  tick(now: number) {
    if (this.result || now < this.deadline) return false;
    this.end(now);
    return true;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
    if (this.lastMiss) this.lastMiss.at += ms;
    if (this.signal) this.signal.at += ms;
  }
}
