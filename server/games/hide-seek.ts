import { BaseEngine } from "./base";
import { shuffled } from "../../shared/rng";
import { integer } from "../../shared/text";
import { hideMaps } from "../../shared/games/hide-seek/maps";
import { unlockedLevel, unlockNext } from "../../shared/games/progress";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import type { Seat } from "../../shared/protocol";
export class HideSeek extends BaseEngine {
  level: number;
  round = 0;
  phase: "hide" | "seek" | "round-end" = "hide";
  hiding: number | null = null;
  decoys: number[] = [];
  suspicious: number[] = [];
  searches: number[] = [];
  deadline: number;
  moves = 0;
  deadUsed = false;
  deadActive = false;
  hint = "";
  sound: { room: number; at: number } | null = null;
  scores = [0, 0];
  lastRound: { winner: Seat; spot: string; points: number } | null = null;
  history: { winner: Seat; spot: string; points: number }[] = [];
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("hide-seek", run, o, seed, at, c);
    this.level = Math.max(
      0,
      Math.min(2, unlockedLevel(c, this.id, 3) - 1, Number(o.map || 1) - 1),
    );
    this.deadline = at + 30000;
  }
  get map() {
    return hideMaps[this.level];
  }
  get hider() {
    return ((this.round + 1) % 2) as Seat;
  }
  get seeker() {
    return (1 - this.hider) as Seat;
  }
  view(seat: Seat, now = this.startAt) {
    return {
      level: this.level,
      mapName: this.map.name,
      round: this.round,
      phase: this.phase,
      hider: this.hider,
      seeker: this.seeker,
      rooms: this.map.rooms,
      spots: this.map.spots,
      suspicious: this.phase === "hide" ? [] : this.suspicious,
      searches: this.searches,
      attempts: 6,
      deadline: this.deadline,
      hint: this.hint,
      scores: this.scores,
      lastRound: this.lastRound,
      sound: this.sound && now - this.sound.at < 2500 ? this.sound : null,
      ...(seat === this.hider
        ? {
            ownHide: this.hiding,
            ownDecoys: this.decoys,
            movesLeft: 2 - this.moves,
            canPlayDead: !this.deadUsed,
          }
        : {}),
      history: this.history,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || p?.round !== this.round) throw Error("STALE");
    if (now >= this.deadline) {
      return this.tick(now);
    }
    if (cmd === "next") {
      if (this.phase !== "round-end") throw Error("INVALID");
      this.next(now);
      return true;
    }
    if (cmd === "hide") {
      if (this.phase !== "hide" || seat !== this.hider)
        throw Error("NOT_YOUR_TURN");
      const id = integer(p?.id, 0, this.map.spots.length - 1);
      if (
        !Array.isArray(p?.decoys) ||
        p.decoys.length !== 2 ||
        new Set(p.decoys).size !== 2 ||
        p.decoys.includes(id)
      )
        throw Error("INVALID");
      this.decoys = p.decoys.map((id: unknown) =>
        integer(id, 0, this.map.spots.length - 1),
      );
      this.hiding = id;
      this.suspicious = shuffled(
        [
          ...this.decoys,
          id,
          ...shuffled(
            this.map.spots
              .map((s) => s.id)
              .filter((s) => s !== id && !this.decoys.includes(s)),
            this.seed + this.round * 17,
          ).slice(0, 2),
        ],
        this.seed + this.round * 101,
      );
      this.phase = "seek";
      this.deadline = now + 60000;
      return true;
    }
    if (this.phase !== "seek") throw Error("INVALID");
    if (cmd === "move") {
      if (seat !== this.hider || this.moves >= 2) throw Error("NOT_YOUR_TURN");
      const id = integer(p?.id, 0, this.map.spots.length - 1),
        spot = this.map.spots[this.hiding!];
      if (!spot.neighbors.includes(id) || this.decoys.includes(id))
        throw Error("INVALID");
      this.hiding = id;
      this.moves++;
      this.sound = { room: spot.room, at: now };
      return true;
    }
    if (cmd === "dead") {
      if (seat !== this.hider || this.deadUsed) throw Error("INVALID");
      this.deadUsed = true;
      this.deadActive = true;
      return true;
    }
    if (cmd !== "search" || seat !== this.seeker) throw Error("NOT_YOUR_TURN");
    const id = integer(p?.id, 0, this.map.spots.length - 1);
    this.searches.push(id);
    if (this.deadActive) {
      this.hint = "很安静";
      this.deadActive = false;
    } else if (id === this.hiding) {
      this.endRound(this.seeker, 110 - this.searches.length * 10, now);
      return true;
    } else if (this.decoys.includes(id)) {
      this.hint = "是个陷阱！多浪费了五秒";
      this.deadline -= 5000;
      this.decoys = this.decoys.filter((d) => d !== id);
    } else {
      const room = this.map.spots[id].room,
        hiddenRoom = this.map.spots[this.hiding!].room;
      this.hint =
        room === hiddenRoom
          ? "好像听到呼吸声"
          : this.map.rooms[room].adjacent.includes(hiddenRoom)
            ? "隔壁有动静"
            : "很安静";
    }
    if (this.searches.length >= 6 || now >= this.deadline)
      this.endRound(this.hider, 100, now);
    return true;
  }
  endRound(winner: Seat, points: number, now: number) {
    this.scores[winner] += points;
    this.lastRound = {
      winner,
      points,
      spot:
        this.hiding === null
          ? "没有及时躲好"
          : this.map.rooms[this.map.spots[this.hiding].room].name +
            " · " +
            this.map.spots[this.hiding].name,
    };
    this.history.push(this.lastRound);
    this.phase = "round-end";
    this.deadline = now + 12000;
    this.hint = "本轮结束，交换身份再来";
  }
  next(now: number) {
    if (this.round === 2) {
      const winner =
          this.scores[0] === this.scores[1]
            ? -1
            : this.scores[0] > this.scores[1]
              ? 0
              : 1,
        stars =
          Math.max(...this.scores) >= 250
            ? 3
            : Math.max(...this.scores) >= 150
              ? 2
              : 1;
      this.done(
        "房间里的秘密",
        winner === -1 ? "默契平局" : `玩家 ${winner + 1} 获胜`,
        [
          `${this.scores[0]} : ${this.scores[1]}`,
          "每一次小小的动静，都是你留下的线索。",
        ],
        {
          winner,
          stars,
          score0: this.scores[0],
          score1: this.scores[1],
          level: this.level + 1,
        },
      );
      unlockNext(this.ctx, this.id, this.level + 1, 3);
      this.ctx.gallery("hide-seek", this.map.name + " · 捉迷藏回忆", {
        stars,
        lines: this.history.map(
          (h, i) =>
            `第${i + 1}轮：${h.spot}，玩家${h.winner + 1} ${h.points}分`,
        ),
      });
      return;
    }
    this.round++;
    this.phase = "hide";
    this.hiding = null;
    this.decoys = [];
    this.suspicious = [];
    this.searches = [];
    this.moves = 0;
    this.deadUsed = false;
    this.deadActive = false;
    this.hint = "";
    this.sound = null;
    this.deadline = now + 30000;
  }
  tick(now: number) {
    if (this.result || now < this.deadline) return false;
    if (this.phase === "round-end") this.next(now);
    else
      this.endRound(this.phase === "hide" ? this.seeker : this.hider, 100, now);
    return true;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
    if (this.sound) this.sound.at += ms;
  }
}
