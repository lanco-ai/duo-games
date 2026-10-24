import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import { dimensions } from "../../shared/games/puzzle-us/shape";
import { mulberry32 } from "../../shared/rng";
import { integer } from "../../shared/text";
export interface Group {
  id: number;
  x: number;
  y: number;
  pieces: number[];
  lockedBy: Seat | null;
  leaseUntil: number;
  placed: boolean;
}
export class Puzzle extends BaseEngine {
  groups: Group[];
  dims: ReturnType<typeof dimensions>;
  counts = [0, 0];
  hands: [any, any] = [null, null];
  focus: any = null;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("puzzle-us", run, o, seed, at, c);
    this.dims = dimensions(Number(o.pieces), c.imageRatio || 1.5);
    const rand = mulberry32(seed),
      d = this.dims;
    this.groups = Array.from({ length: Number(o.pieces) }, (_, i) => {
      const side = i % 4,
        px =
          side < 2 ? -d.pw * (1.4 + rand()) : d.width + d.pw * (0.4 + rand()),
        py = rand() * d.height;
      return {
        id: i,
        x: Math.round((side % 2 ? rand() * d.width : px) - (i % d.cols) * d.pw),
        y: Math.round(
          (side === 1
            ? -d.ph * (1 + rand())
            : side === 3
              ? d.height + d.ph * (0.2 + rand())
              : py) -
            Math.floor(i / d.cols) * d.ph,
        ),
        pieces: [i],
        lockedBy: null,
        leaseUntil: 0,
        placed: false,
      };
    });
  }
  view() {
    return {
      image: this.options.image,
      seed: this.seed,
      ...this.dims,
      groups: this.groups,
      counts: this.counts,
      hands: this.hands,
      focus: this.focus,
      startAt: this.startAt,
    };
  }
  position(p: any) {
    const x = Number(p?.x),
      y = Number(p?.y);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 6000 ||
      Math.abs(y) > 6000
    )
      throw new Error("INVALID");
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  release(now: number) {
    let changed = false;
    for (const g of this.groups)
      if (g.lockedBy !== null && g.leaseUntil <= now) {
        g.lockedBy = null;
        changed = true;
      }
    return changed;
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result) throw new Error("INVALID");
    this.release(now);
    if (cmd === "focus") {
      const pos = this.position(p);
      this.focus = { ...pos, by: seat, at: now };
      return true;
    }
    const id = integer(p?.gid, 0, 149),
      g = this.groups.find((g) => g.id === id);
    if (!g || g.placed) throw new Error("STALE");
    if (cmd === "grab") {
      if (g.lockedBy !== null && g.lockedBy !== seat) throw new Error("LOCKED");
      g.lockedBy = seat;
      g.leaseUntil = now + 3000;
      return true;
    }
    if (cmd === "drop") {
      if (g.lockedBy !== seat) throw new Error("LOCKED");
      Object.assign(g, this.position(p));
      g.lockedBy = null;
      g.leaseUntil = 0;
      const d = this.dims,
        tolerance = Math.min(d.pw, d.ph) * 0.2;
      let placedCount = 0;
      if (Math.hypot(g.x, g.y) < tolerance) {
        g.x = g.y = 0;
        g.placed = true;
        placedCount = g.pieces.length;
      }
      let merged = true;
      while (merged) {
        merged = false;
        for (const other of this.groups) {
          if (
            other === g ||
            other.lockedBy !== null ||
            Math.hypot(g.x - other.x, g.y - other.y) >= tolerance
          )
            continue;
          const adjacent = g.pieces.some((a) =>
            other.pieces.some(
              (b) =>
                Math.abs((a % d.cols) - (b % d.cols)) +
                  Math.abs(Math.floor(a / d.cols) - Math.floor(b / d.cols)) ===
                1,
            ),
          );
          if (!adjacent) continue;
          if (other.placed && !g.placed) {
            placedCount += g.pieces.length;
            g.placed = true;
          } else if (g.placed && !other.placed)
            placedCount += other.pieces.length;
          if (g.placed || other.placed) {
            g.x = 0;
            g.y = 0;
          } else {
            g.x = other.x;
            g.y = other.y;
          }
          g.pieces.push(...other.pieces);
          this.groups = this.groups.filter((x) => x !== other);
          merged = true;
          break;
        }
      }
      this.counts[seat] += placedCount;
      if (this.groups.every((g) => g.placed)) {
        const seconds = Math.round((now - this.startAt) / 1000);
        this.done(
          "拼出了我们的回忆",
          seconds + " 秒",
          [
            `玩家 1 拼了 ${this.counts[0]} 块 · 玩家 2 拼了 ${this.counts[1]} 块`,
          ],
          {
            seconds,
            pieces: Number(this.options.pieces),
            player0: this.counts[0],
            player1: this.counts[1],
          },
        );
        this.ctx.gallery("puzzle", "拼出我们", {
          image: this.options.image,
          pieces: this.options.pieces,
          seconds,
        });
      }
      return true;
    }
    throw new Error("INVALID");
  }
  stream(seat: Seat, kind: string, p: any, now: number) {
    if (kind !== "cur" || this.result) return;
    const pos = this.position(p);
    if (p.op === "hand") {
      this.hands[seat] = { ...pos, at: now };
      this.ctx.emit("hand", { ...pos, seat }, undefined, true);
      return;
    }
    if (p.op === "move") {
      const g = this.groups.find((g) => g.id === p.gid);
      if (!g || g.placed || g.lockedBy !== seat || g.leaseUntil <= now) return;
      Object.assign(g, pos);
      g.leaseUntil = now + 3000;
      this.ctx.emit(
        "piece",
        { gid: g.id, ...pos, seat, leaseUntil: g.leaseUntil },
        undefined,
        true,
      );
    }
  }
  tick(now: number) {
    return this.release(now);
  }
  pause() {
    for (const g of this.groups) {
      g.lockedBy = null;
      g.leaseUntil = 0;
    }
  }
  shift(ms: number) {
    super.shift(ms);
  }
}
