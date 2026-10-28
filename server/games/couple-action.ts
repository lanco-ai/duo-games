import { BaseEngine } from "./base";
import { mulberry32, shuffled } from "../../shared/rng";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
import { integer } from "../../shared/text";

export { CoopKitchen } from "./kitchen";

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
