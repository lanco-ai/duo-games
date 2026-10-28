import { BaseEngine } from "./base";
import { mulberry32 } from "../../shared/rng";
import { integer } from "../../shared/text";
import { unlockedLevel, unlockNext } from "../../shared/games/progress";
import {
  kitchenLevels,
  kitchenStations,
  walkable,
  recipes,
  cakeSteps,
  type FoodKind,
  type Recipe,
} from "../../shared/games/coop-kitchen/levels";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
type Food = {
  kind: FoodKind;
  stage: "raw" | "chopped" | "cooked" | "boiled" | "burned";
  cuts: number;
};
type Plate = { kind: "plate"; foods: Food[]; dirty: boolean };
type Item = Food | Plate;
type Job = { station: string; at: number };
type Pan = { item: Food; at: number } | null;
export class CoopKitchen extends BaseEngine {
  level: number;
  endless: boolean;
  rand: () => number;
  swapped = false;
  nextSwap: number;
  endsAt: number;
  orders: { id: number; kind: Recipe; deadline: number }[] = [];
  nextOrder = 0;
  players: [
    { x: number; y: number; held: Item | null },
    { x: number; y: number; held: Item | null },
  ] = [
    { x: 1, y: 3, held: null },
    { x: 6, y: 3, held: null },
  ];
  boards: [Food | null, Food | null] = [null, null];
  pans: [Pan, Pan] = [null, null];
  pot: Pan = null;
  plates: [Plate | null, Plate | null] = [
    { kind: "plate", foods: [], dirty: false },
    { kind: "plate", foods: [], dirty: false },
  ];
  handoffs: [Item | null, Item | null] = [null, null];
  jobs: [Job | null, Job | null] = [null, null];
  credits = [0.5, 0.5];
  movedAt: number[];
  score = 0;
  served = 0;
  missed = 0;
  combo = 0;
  cakeStep = 0;
  cakeDone = false;
  contributions = [
    { cuts: 0, served: 0, passed: 0 },
    { cuts: 0, served: 0, passed: 0 },
  ];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("coop-kitchen", run, o, seed, at, c);
    const unlocked = unlockedLevel(c, this.id, 6);
    this.endless = o.level === "endless" && unlocked === 6;
    this.level = this.endless
      ? 4
      : Math.max(0, Math.min(unlocked - 1, 4, Number(o.level || 1) - 1));
    this.rand = mulberry32(seed);
    this.endsAt = at + kitchenLevels[this.level].seconds * 1000;
    this.nextSwap = at + 30000;
    this.movedAt = [at, at];
    if (this.level === 4) this.players[1].y = 4;
    this.addOrder(at);
    this.addOrder(at);
  }
  get stations() {
    return kitchenStations(this.level, this.swapped);
  }
  view(_seat?: Seat, now = this.startAt) {
    return {
      level: this.level,
      levelName: kitchenLevels[this.level].name,
      bar: kitchenLevels[this.level].bar,
      players: this.players,
      stations: this.stations,
      boards: this.boards,
      pans: this.pans,
      pot: this.pot,
      plates: this.plates,
      handoffs: this.handoffs,
      jobs: this.jobs,
      orders: this.orders,
      score: this.score,
      served: this.served,
      missed: this.missed,
      endsAt: this.endsAt,
      endless: this.endless,
      combo: this.combo,
      cakeStep: this.cakeStep,
      cakeLabel: cakeSteps[this.cakeStep],
      cakeDone: this.cakeDone,
      now,
      contributions: this.contributions,
    };
  }
  move(seat: Seat, x: number, y: number, now: number) {
    const player = this.players[seat],
      distance = Math.hypot(x - player.x, y - player.y);
    this.credits[seat] = Math.min(
      2,
      this.credits[seat] + Math.max(0, now - this.movedAt[seat]) * 0.004,
    );
    this.movedAt[seat] = now;
    if (
      distance > 2 ||
      distance > this.credits[seat] ||
      !walkable(x, y, this.stations, kitchenLevels[this.level].bar)
    )
      return false;
    for (let i = 1; i <= Math.ceil(distance * 12); i++) {
      const t = i / Math.ceil(distance * 12);
      if (
        !walkable(
          player.x + (x - player.x) * t,
          player.y + (y - player.y) * t,
          this.stations,
          kitchenLevels[this.level].bar,
        )
      )
        return false;
    }
    if (
      kitchenLevels[this.level].bar &&
      Math.sign(player.x - 4) !== Math.sign(x - 4)
    )
      return false;
    this.credits[seat] -= distance;
    player.x = x;
    player.y = y;
    this.jobs[seat] = null;
    return true;
  }
  stream(seat: Seat, kind: string, p: any, now: number) {
    if (kind !== "cur" || this.result) return;
    const x = Number(p?.x),
      y = Number(p?.y);
    if (this.move(seat, x, y, now))
      this.ctx.emit("kitchen-pos", { seat, x, y }, undefined, true);
    else
      this.ctx.emit(
        "kitchen-pos",
        { seat, x: this.players[seat].x, y: this.players[seat].y },
        seat,
        true,
      );
  }
  near(seat: Seat, id: string) {
    const s = this.stations.find((s) => s.id === id),
      p = this.players[seat];
    if (!s || Math.hypot(p.x - s.x, p.y - s.y) > 1.2) throw Error("INVALID");
    return s;
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw Error("INVALID");
    if (cmd === "move") {
      const dx = integer(p?.dx, -1, 1),
        dy = integer(p?.dy, -1, 1);
      if (Math.abs(dx) + Math.abs(dy) !== 1) throw Error("INVALID");
      return this.move(
        seat,
        this.players[seat].x + dx,
        this.players[seat].y + dy,
        now,
      );
    }
    if (cmd === "cancel") {
      this.tick(now);
      this.jobs[seat] = null;
      return true;
    }
    if (cmd !== "interact") throw Error("INVALID");
    const s = this.near(seat, p?.station),
      player = this.players[seat];
    if (this.jobs.some((j, i) => i !== seat && j?.station === s.id))
      throw Error("LOCKED");
    const n = Number(s.id.at(-1)) as 0 | 1;
    if (["tomato", "lettuce", "meat", "bread"].includes(s.id)) {
      if (player.held) throw Error("INVALID");
      player.held = { kind: s.id as FoodKind, stage: "raw", cuts: 0 };
      return true;
    }
    if (s.id === "trash") {
      if (!player.held) throw Error("INVALID");
      if (player.held.kind === "plate") {
        player.held.foods = [];
        player.held.dirty = this.level >= 2;
      } else player.held = null;
      return true;
    }
    if (s.id.startsWith("handoff")) {
      if (player.held && this.handoffs[n]) throw Error("LOCKED");
      if (player.held) {
        this.handoffs[n] = player.held;
        player.held = null;
      } else {
        if (!this.handoffs[n]) throw Error("INVALID");
        player.held = this.handoffs[n];
        this.handoffs[n] = null;
        this.contributions[seat].passed++;
      }
      return true;
    }
    if (s.id.startsWith("board")) {
      const item = this.boards[n];
      if (
        !item &&
        player.held &&
        player.held.kind !== "plate" &&
        player.held.kind !== "bread" &&
        player.held.stage === "raw"
      ) {
        this.boards[n] = player.held;
        player.held = null;
        return true;
      }
      if (item && !player.held) {
        if (item.stage === "raw") this.jobs[seat] = { station: s.id, at: now };
        else {
          player.held = item;
          this.boards[n] = null;
        }
        return true;
      }
      throw Error("INVALID");
    }
    if (s.id.startsWith("pan") || s.id === "pot") {
      const pan = s.id === "pot" ? this.pot : this.pans[n];
      if (
        !pan &&
        player.held?.kind === "meat" &&
        player.held.stage === "chopped"
      ) {
        const v = { item: player.held, at: now };
        if (s.id === "pot") this.pot = v;
        else this.pans[n] = v;
        player.held = null;
        return true;
      }
      const wait = s.id === "pot" ? 8000 : 5000;
      if (pan && !player.held && now - pan.at >= wait) {
        pan.item.stage =
          now - pan.at >= (s.id === "pot" ? 15000 : 10000)
            ? "burned"
            : s.id === "pot"
              ? "boiled"
              : "cooked";
        player.held = pan.item;
        if (s.id === "pot") this.pot = null;
        else this.pans[n] = null;
        return true;
      }
      throw Error("INVALID");
    }
    if (s.id.startsWith("plate")) {
      const plate = this.plates[n];
      if (player.held?.kind === "plate") {
        if (plate) throw Error("LOCKED");
        this.plates[n] = player.held;
        player.held = null;
        return true;
      }
      if (!plate) throw Error("INVALID");
      if (player.held) {
        if (
          plate.dirty ||
          player.held.stage === "burned" ||
          plate.foods.some((f) => f.kind === player.held!.kind)
        )
          throw Error("INVALID");
        plate.foods.push(player.held);
        player.held = null;
        return true;
      }
      player.held = plate;
      this.plates[n] = null;
      return true;
    }
    if (s.id === "sink") {
      if (player.held?.kind !== "plate" || !player.held.dirty)
        throw Error("INVALID");
      this.jobs[seat] = { station: s.id, at: now };
      return true;
    }
    if (s.id.startsWith("cake")) {
      if (this.cakeDone) throw Error("INVALID");
      this.jobs[seat] = { station: s.id, at: now };
      return true;
    }
    if (s.id === "serve") {
      if (player.held?.kind !== "plate" || player.held.dirty)
        throw Error("INVALID");
      const foods = player.held.foods
          .map((f) => f.kind + ":" + f.stage)
          .sort()
          .join(","),
        order = this.orders.find(
          (o) => [...recipes[o.kind].foods].sort().join(",") === foods,
        );
      if (!order) throw Error("INVALID");
      this.combo = Math.min(5, this.combo + 1);
      this.score += Math.round(
        recipes[order.kind].score * (1 + (this.combo - 1) * 0.125),
      );
      this.served++;
      this.contributions[seat].served++;
      this.orders = this.orders.filter((o) => o.id !== order.id);
      player.held.foods = [];
      player.held.dirty = this.level >= 2;
      this.addOrder(now);
      return true;
    }
    throw Error("INVALID");
  }
  addOrder(now: number) {
    if (this.orders.length >= 4) return;
    const pool = kitchenLevels[this.level].recipes;
    this.orders.push({
      id: this.nextOrder++,
      kind: pool[Math.floor(this.rand() * pool.length)] as Recipe,
      deadline:
        now +
        Math.max(
          18000,
          60000 - (this.endless ? Math.floor(this.served / 3) * 1500 : 0),
        ),
    });
  }
  tick(now: number) {
    if (this.result) return false;
    let changed = false;
    for (const seat of [0, 1] as Seat[]) {
      const j = this.jobs[seat];
      if (!j) continue;
      try {
        this.near(seat, j.station);
      } catch {
        this.jobs[seat] = null;
        continue;
      }
      if (now - j.at < 2000) continue;
      if (j.station.startsWith("board")) {
        const i = Number(j.station.at(-1)) as 0 | 1;
        if (this.boards[i]) {
          this.boards[i]!.stage = "chopped";
          this.boards[i]!.cuts = 3;
          this.contributions[seat].cuts++;
        }
        this.jobs[seat] = null;
        changed = true;
      } else if (j.station === "sink") {
        const item = this.players[seat].held;
        if (item?.kind === "plate") item.dirty = false;
        this.jobs[seat] = null;
        changed = true;
      }
    }
    if (
      this.jobs.every((j) => j?.station.startsWith("cake")) &&
      this.jobs[0]!.station !== this.jobs[1]!.station &&
      this.jobs.every((j) => now - j!.at >= 2000)
    ) {
      this.cakeStep++;
      this.jobs = [null, null];
      changed = true;
      if (this.cakeStep === cakeSteps.length) {
        this.cakeDone = true;
        this.score += 600;
        this.served++;
        this.contributions.forEach((c) => c.served++);
      }
    }
    for (const [pan, limit] of [
      [this.pans[0], 10000],
      [this.pans[1], 10000],
      [this.pot, 15000],
    ] as const)
      if (pan && now - pan.at >= limit && pan.item.stage !== "burned") {
        pan.item.stage = "burned";
        changed = true;
      }
    const missed = this.orders.filter((o) => now >= o.deadline);
    if (missed.length) {
      this.missed += missed.length;
      this.score = Math.max(0, this.score - missed.length * 30);
      this.combo = 0;
      this.orders = this.orders.filter((o) => now < o.deadline);
      for (const _ of missed) this.addOrder(now);
      changed = true;
    }
    if (kitchenLevels[this.level].swap && now >= this.nextSwap) {
      this.swapped = !this.swapped;
      this.nextSwap += 30000;
      this.jobs = [null, null];
      changed = true;
    }
    if (!this.endless && now >= this.endsAt) {
      const stars = kitchenLevels[this.level].stars.filter(
        (s) => this.score >= s,
      ).length;
      this.done(
        "厨房打烊",
        stars ? "★".repeat(stars) : this.score + " 分",
        [
          `${this.served} 单 · 超时 ${this.missed} 单`,
          ...this.contributions.map(
            (c, i) =>
              `玩家${i + 1} 切菜${c.cuts} 出菜${c.served} 传递${c.passed}`,
          ),
          "最佳传菜搭档，下次继续一起做饭。",
        ],
        {
          score: this.score,
          stars,
          served: this.served,
          missed: this.missed,
          level: this.level + 1,
        },
      );
      if (stars) unlockNext(this.ctx, this.id, this.level + 1, 6);
      this.ctx.gallery("kitchen", kitchenLevels[this.level].name, {
        stars,
        score: this.score,
        contributions: this.contributions,
      });
      return true;
    }
    return changed;
  }
  shift(ms: number) {
    super.shift(ms);
    this.endsAt += ms;
    this.nextSwap += ms;
    this.movedAt = this.movedAt.map((t) => t + ms);
    for (const o of this.orders) o.deadline += ms;
    for (const p of [...this.pans, this.pot]) if (p) p.at += ms;
    for (const j of this.jobs) if (j) j.at += ms;
  }
}
