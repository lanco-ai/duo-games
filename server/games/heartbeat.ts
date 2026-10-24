import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { GameOptions, EngineContext } from "../../shared/games/types";
import {
  chart,
  accuracy,
  type TrackId,
} from "../../shared/games/heartbeat/chart";
import { integer } from "../../shared/text";
export class Heartbeat extends BaseEngine {
  song: ReturnType<typeof chart>;
  grades: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  synced = new Set<number>();
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("heartbeat", run, o, seed, at, c);
    this.song = chart(o.track as TrackId);
  }
  view(seat: Seat) {
    return {
      track: this.options.track,
      startAt: this.startAt,
      duration: this.song.duration,
      own: [...this.grades[seat]],
      counts: this.grades.map((x) => x.size),
      scores: this.grades.map((x) =>
        [...x.values()].reduce((a, b) => a + b, 0),
      ),
      synced: [...this.synced],
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (
      cmd !== "results" ||
      this.result ||
      !Array.isArray(p?.entries) ||
      p.entries.length > 32
    )
      throw new Error("INVALID");
    const entries = p.entries.map((pair: any) => {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error("INVALID");
      const id = integer(pair[0], 0, this.song.notes.length - 1),
        g = integer(pair[1], 0, 3),
        note = this.song.notes[id];
      if (!note.seats.includes(seat) || now < this.startAt + note.ms - 400)
        throw new Error("INVALID");
      return [id, g];
    });
    let changed = false;
    for (const [id, g] of entries) {
      if (this.grades[seat].has(id)) continue;
      this.grades[seat].set(id, g);
      changed = true;
      if (
        this.song.notes[id].sync &&
        g > 0 &&
        (this.grades[(1 - seat) as Seat].get(id) || 0) > 0 &&
        !this.synced.has(id)
      ) {
        this.synced.add(id);
        this.ctx.emit("sync", { note: id });
      }
    }
    return changed;
  }
  tick(now: number) {
    if (this.result || now < this.startAt + this.song.duration + 5000)
      return false;
    const syncCount = this.song.notes.filter((n) => n.sync).length,
      percent = Math.round((this.synced.size / syncCount) * 100),
      scores = this.grades.map((x) =>
        [...x.values()].reduce((a, b) => a + b, 0),
      );
    this.done(
      "我们的心跳同步率",
      percent + "%",
      [
        `总分 ${scores[0] + scores[1] + this.synced.size * 3} · 合拍 ${this.synced.size}/${syncCount}`,
        `玩家 1 准确率 ${accuracy([...this.grades[0].values()], this.song.notes.filter((n) => n.seats.includes(0)).length)}% · 玩家 2 准确率 ${accuracy([...this.grades[1].values()], this.song.notes.filter((n) => n.seats.includes(1)).length)}%`,
      ],
      {
        score: scores[0] + scores[1] + this.synced.size * 3,
        sync: percent,
        accuracy0: accuracy(
          [...this.grades[0].values()],
          this.song.notes.filter((n) => n.seats.includes(0)).length,
        ),
        accuracy1: accuracy(
          [...this.grades[1].values()],
          this.song.notes.filter((n) => n.seats.includes(1)).length,
        ),
      },
    );
    return true;
  }
  shift(_ms: number) {} // Local rhythm never pauses or changes its audio timeline.
}
