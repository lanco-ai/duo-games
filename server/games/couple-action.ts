import { BaseEngine } from "./base";
import { mulberry32, shuffled } from "../../shared/rng";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
import { integer } from "../../shared/text";

type Ingredient = {
  kind: "tomato" | "lettuce" | "meat" | "bread";
  stage: "raw" | "chopped" | "cooked" | "burned";
  cuts: number;
};
const stations = [
  { id: "tomato", x: 0, y: 0, label: "🍅 番茄" },
  { id: "lettuce", x: 2, y: 0, label: "🥬 生菜" },
  { id: "meat", x: 4, y: 0, label: "🥩 肉饼" },
  { id: "bread", x: 6, y: 0, label: "🍞 面包" },
  { id: "board0", x: 7, y: 1, label: "🔪 切菜板" },
  { id: "board1", x: 7, y: 3, label: "🔪 切菜板" },
  { id: "pan0", x: 7, y: 5, label: "🍳 煎锅" },
  { id: "pan1", x: 7, y: 7, label: "🍳 煎锅" },
  { id: "trash", x: 0, y: 7, label: "🗑️ 垃圾桶" },
  { id: "plate", x: 3, y: 7, label: "🍽️ 装盘台" },
  { id: "serve", x: 6, y: 7, label: "🔔 出菜口" },
] as const;
type Pan = { item: Ingredient; at: number } | null;
type Order = { kind: "burger" | "salad"; deadline: number; id: number };
export class CoopKitchen extends BaseEngine {
  players: [
    { x: number; y: number; held: Ingredient | null },
    { x: number; y: number; held: Ingredient | null },
  ] = [
    { x: 1, y: 3, held: null },
    { x: 3, y: 3, held: null },
  ];
  boards: [Ingredient | null, Ingredient | null] = [null, null];
  pans: [Pan, Pan] = [null, null];
  plate: Ingredient[] = [];
  orders: Order[];
  score = 0;
  missed = 0;
  served = 0;
  endsAt: number;
  nextOrder = 2;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("coop-kitchen", run, o, seed, at, c);
    this.orders = [
      { kind: "burger", deadline: at + 45000, id: 0 },
      { kind: "salad", deadline: at + 30000, id: 1 },
    ];
    this.endsAt = at + 180000;
  }
  view() {
    return {
      players: this.players,
      stations,
      boards: this.boards,
      pans: this.pans,
      plate: this.plate,
      orders: this.orders,
      score: this.score,
      missed: this.missed,
      served: this.served,
      endsAt: this.endsAt,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw new Error("INVALID");
    const player = this.players[seat];
    if (cmd === "move") {
      const dx = integer(p?.dx, -1, 1),
        dy = integer(p?.dy, -1, 1);
      if (Math.abs(dx) + Math.abs(dy) !== 1) throw new Error("INVALID");
      const x = player.x + dx,
        y = player.y + dy;
      if (
        x < 0 ||
        x > 7 ||
        y < 0 ||
        y > 7 ||
        stations.some((s) => s.x === x && s.y === y) ||
        (this.players[1 - seat].x === x && this.players[1 - seat].y === y)
      )
        return false;
      player.x = x;
      player.y = y;
      return true;
    }
    if (cmd !== "interact") throw new Error("INVALID");
    const station = stations.find((x) => x.id === p?.station);
    if (
      !station ||
      Math.abs(station.x - player.x) + Math.abs(station.y - player.y) > 1
    )
      throw new Error("INVALID");
    if (["tomato", "lettuce", "meat", "bread"].includes(station.id)) {
      if (player.held) throw new Error("INVALID");
      player.held = {
        kind: station.id as Ingredient["kind"],
        stage: "raw",
        cuts: 0,
      };
      return true;
    }
    if (station.id === "trash") {
      if (!player.held) throw new Error("INVALID");
      player.held = null;
      return true;
    }
    if (station.id.startsWith("board")) {
      const n = Number(station.id.at(-1)) as 0 | 1,
        item = this.boards[n];
      if (!item && player.held) {
        if (player.held.stage !== "raw" || player.held.kind === "bread")
          throw new Error("INVALID");
        this.boards[n] = player.held;
        player.held = null;
        return true;
      }
      if (item && player.held === null) {
        if (item.stage === "raw") {
          item.cuts++;
          if (item.cuts >= 3) item.stage = "chopped";
        } else {
          player.held = item;
          this.boards[n] = null;
        }
        return true;
      }
      throw new Error("INVALID");
    }
    if (station.id.startsWith("pan")) {
      const n = Number(station.id.at(-1)) as 0 | 1,
        pan = this.pans[n];
      if (
        !pan &&
        player.held?.kind === "meat" &&
        player.held.stage === "chopped"
      ) {
        this.pans[n] = { item: player.held, at: now };
        player.held = null;
        return true;
      }
      if (pan && !player.held) {
        if (now - pan.at < 5000) throw new Error("INVALID");
        pan.item.stage = now - pan.at >= 10000 ? "burned" : "cooked";
        player.held = pan.item;
        this.pans[n] = null;
        return true;
      }
      throw new Error("INVALID");
    }
    if (station.id === "plate") {
      if (
        !player.held ||
        player.held.stage === "burned" ||
        this.plate.some((i) => i.kind === player.held!.kind)
      )
        throw new Error("INVALID");
      if (
        (player.held.kind === "meat" && player.held.stage !== "cooked") ||
        (["tomato", "lettuce"].includes(player.held.kind) &&
          player.held.stage !== "chopped")
      )
        throw new Error("INVALID");
      this.plate.push(player.held);
      player.held = null;
      return true;
    }
    if (station.id === "serve") {
      const kinds = this.plate
        .map((x) => x.kind)
        .sort()
        .join(",");
      const kind =
        kinds === "bread,meat"
          ? "burger"
          : kinds === "lettuce,tomato"
            ? "salad"
            : null;
      const order = this.orders.find((x) => x.kind === kind);
      if (!kind || !order) throw new Error("INVALID");
      this.score += kind === "burger" ? 120 : 80;
      this.served++;
      this.plate = [];
      this.orders = this.orders.filter((x) => x.id !== order.id);
      this.addOrder(now);
      return true;
    }
    throw new Error("INVALID");
  }
  addOrder(now: number) {
    const kind = this.nextOrder % 2 ? "salad" : "burger";
    this.orders.push({
      kind,
      deadline: now + (kind === "burger" ? 45000 : 30000),
      id: this.nextOrder++,
    });
  }
  tick(now: number) {
    if (this.result) return false;
    let changed = false;
    for (const pan of this.pans)
      if (pan && now - pan.at >= 10000 && pan.item.stage !== "burned") {
        pan.item.stage = "burned";
        changed = true;
      }
    const expired = this.orders.filter((o) => now >= o.deadline);
    if (expired.length) {
      this.missed += expired.length;
      this.orders = this.orders.filter((o) => now < o.deadline);
      for (const _ of expired) this.addOrder(now);
      changed = true;
    }
    if (now >= this.endsAt) {
      this.done(
        "厨房打烊",
        `${this.score} 分`,
        [`完成 ${this.served} 单 · 超时 ${this.missed} 单`],
        { score: this.score, served: this.served, missed: this.missed },
      );
      return true;
    }
    return changed;
  }
  shift(ms: number) {
    super.shift(ms);
    this.endsAt += ms;
    for (const o of this.orders) o.deadline += ms;
    for (const p of this.pans) if (p) p.at += ms;
  }
}

export class HideSeek extends BaseEngine {
  mode: string;
  phase: "hide" | "seek" = "hide";
  hiding: number | null = null;
  decoys: number[] = [];
  searches: number[] = [];
  deadline: number;
  keys: number[] = [];
  collected: number[] = [];
  seeker = 0;
  prop = "🪴";
  hint = "";
  furniture: string[];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("hide-seek", run, o, seed, at, c);
    this.mode = String(o.mode);
    this.deadline = at + 10000;
    this.keys = shuffled(
      Array.from({ length: 12 }, (_, i) => i),
      seed,
    ).slice(0, 3);
    const rand = mulberry32(seed);
    this.furniture = Array.from(
      { length: 12 },
      () => ["🪴", "💡", "🧸"][Math.floor(rand() * 3)],
    );
  }
  view(seat: Seat) {
    const furniture = [...this.furniture];
    if (this.mode === "realtime" && this.hiding !== null)
      furniture[this.hiding] = this.prop;
    const visibleFurniture =
      this.mode === "realtime" && seat === 0
        ? furniture.map((item, id) =>
            this.phase === "seek" && Math.floor(id / 3) === this.seeker
              ? item
              : null,
          )
        : furniture;
    return {
      mode: this.mode,
      phase: this.phase,
      deadline: this.deadline,
      searches: this.searches,
      attempts: this.mode === "turn" ? 3 : 5,
      seeker: this.seeker,
      hint: this.hint,
      furniture: visibleFurniture,
      ownHide: seat === 1 ? this.hiding : null,
      ownDecoys: seat === 1 ? this.decoys : [],
      keys:
        seat === 1 && this.mode === "realtime"
          ? this.keys.filter((x) => !this.collected.includes(x))
          : [],
      collected: this.collected.length,
      prop: seat === 1 ? this.prop : null,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || now >= this.deadline) throw new Error("INVALID");
    if (this.phase === "hide") {
      if (seat !== 1 || cmd !== "hide") throw new Error("NOT_YOUR_TURN");
      const id = integer(p?.id, 0, 11);
      if (this.mode === "turn") {
        if (
          !Array.isArray(p?.decoys) ||
          p.decoys.length !== 2 ||
          new Set(p.decoys).size !== 2 ||
          p.decoys.includes(id)
        )
          throw new Error("INVALID");
        this.decoys = p.decoys.map((v: unknown) => integer(v, 0, 11));
      } else {
        if (!["🪴", "💡", "🧸"].includes(p?.prop)) throw new Error("INVALID");
        this.prop = p.prop;
      }
      this.hiding = id;
      this.phase = "seek";
      this.deadline = now + 45000;
      return true;
    }
    if (this.mode === "realtime" && seat === 1 && cmd === "move") {
      if (Math.floor(this.hiding! / 3) === this.seeker)
        throw new Error("INVALID");
      const id = integer(p?.id, 0, 11);
      if (id === this.hiding || Math.abs(id - this.hiding!) > 3)
        throw new Error("INVALID");
      this.hiding = id;
      if (this.keys.includes(id) && !this.collected.includes(id)) {
        this.collected.push(id);
        if (this.collected.length === 3) this.end(1, "躲藏者集齐钥匙逃脱");
      }
      return true;
    }
    if (this.mode === "realtime" && seat === 0 && cmd === "light") {
      this.seeker = integer(p?.room, 0, 3);
      return true;
    }
    if (seat !== 0 || cmd !== "search") throw new Error("NOT_YOUR_TURN");
    const id = integer(p?.id, 0, 11);
    if (this.mode === "turn" && this.searches.includes(id))
      throw new Error("INVALID");
    if (this.mode === "realtime" && Math.floor(id / 3) !== this.seeker)
      throw new Error("INVALID");
    this.searches.push(id);
    if (id === this.hiding) {
      this.end(0, "抓捕者找到对方");
      return true;
    }
    this.hint =
      this.mode === "turn"
        ? this.decoys.includes(id)
          ? "发现了一个假诱饵！"
          : Math.floor(id / 3) === Math.floor(this.hiding! / 3)
            ? "在同一房间"
            : Math.abs(id - this.hiding!) <= 3
              ? "脚印很近"
              : "完全错了"
        : "";
    if (this.searches.length >= (this.mode === "turn" ? 3 : 5))
      this.end(1, "躲藏者成功藏住");
    return true;
  }
  end(winner: Seat, label: string) {
    this.done(label, `玩家 ${winner + 1} 获胜`, ["再交换角色玩一次吧。"], {
      winner,
      attempts: this.searches.length,
    });
  }
  tick(now: number) {
    if (!this.result && now >= this.deadline) {
      this.end(
        this.phase === "hide" ? 0 : 1,
        this.phase === "hide" ? "躲藏时间结束" : "躲藏者坚持到了最后",
      );
      return true;
    }
    return false;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
  }
}
