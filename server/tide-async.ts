// 异步潮汐棋：每个房间同一时间最多一盘，每次操作后写库，重启不丢。
// 两人都打开棋盘时，任一方可以切到实时（每回合 30 秒）；有人离开就自动回到异步。
import { randomInt, randomUUID } from "node:crypto";
import type { Seat } from "../shared/protocol";
import {
  SECONDS,
  TURNS,
  newGame,
  resolve,
  validPlay,
  winner,
  type Card,
  type Play,
  type TideState,
} from "../shared/games/tide/rules";
import type { Reward } from "../shared/island/rules";
import type { PushMessage } from "./push";

export interface AsyncMatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  state: TideState;
  picks: [Play | null, Play | null];
  ended?: "abandoned";
  /** 两人各从半途岛带来几张牌 */
  brought?: [number, number];
  /** 下完后两人各拿到的奖励 */
  rewards?: [Reward, Reward];
}
/** 和半途岛的连接：开局取牌、下完发奖励 */
export interface IslandLink {
  takeCards(code: string, seat: Seat): Card[];
  reward(code: string, seat: Seat, won: boolean): Reward;
}
export interface TideStore {
  tideLatest(code: string): AsyncMatch | null;
  tideSave(code: string, match: AsyncMatch): void;
}

const WATCH_MS = 20_000,
  REVEAL_MS = 3_000;

export class AsyncTides {
  private watching = new Map<string, [number, number]>();
  private live = new Map<string, number>(); // 房间 → 本回合截止时间
  constructor(
    private store: TideStore,
    private changed: (code: string) => void,
    private notify: (code: string, seat: Seat, message: PushMessage) => void,
    private names: (code: string) => [string, string],
    private island?: IslandLink,
  ) {}

  private bothWatching(code: string, now: number) {
    const w = this.watching.get(code);
    return !!w && now - w[0] < WATCH_MS && now - w[1] < WATCH_MS;
  }
  private seen(code: string, seat: Seat, now: number) {
    return now - (this.watching.get(code)?.[seat] ?? 0) < WATCH_MS;
  }

  view(code: string, seat: Seat, now: number) {
    const m = this.store.tideLatest(code);
    if (!m) return null;
    const s = m.state,
      other = (1 - seat) as Seat;
    return {
      id: m.id,
      turn: s.turn,
      tides: s.tides,
      board: s.board,
      hand: s.hands[seat],
      deck: s.decks[seat].length,
      otherHand: s.hands[other].length,
      scores: s.scores,
      picked: [!!m.picks[0], !!m.picks[1]],
      pick: m.picks[seat],
      last: s.history.at(-1) ?? null,
      deadline: this.live.get(code) ?? 0,
      together: this.bothWatching(code, now),
      finished: m.finishedAt !== null,
      ended: m.ended ?? null,
      winner: m.finishedAt !== null && !m.ended ? winner(s) : null,
      updatedAt: m.updatedAt,
      brought: m.brought?.[seat] ?? 0,
      reward: m.rewards?.[seat] ?? null,
    };
  }

  act(code: string, seat: Seat, input: any, now: number) {
    const cmd = input?.cmd;
    if (cmd === "watch") {
      const w = this.watching.get(code) ?? [0, 0];
      w[seat] = input.on ? now : 0;
      this.watching.set(code, w);
      if (!input.on && this.live.delete(code)) this.changed(code);
      return;
    }
    let m = this.store.tideLatest(code);
    const mine = this.names(code)[seat];
    const partner = (1 - seat) as Seat,
      url = "r/" + code + "#tide",
      tag = "tide-" + code;
    const tell = (body: string) => {
      if (!this.seen(code, partner, now))
        this.notify(code, partner, { title: "潮汐棋", body, url, tag });
    };
    if (cmd === "new") {
      if (m && m.finishedAt === null) throw new Error("INVALID");
      const own: [Card[], Card[]] = [
        this.island?.takeCards(code, 0) ?? [],
        this.island?.takeCards(code, 1) ?? [],
      ];
      m = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
        state: newGame(randomInt(2 ** 31), own),
        picks: [null, null],
        brought: [own[0].length, own[1].length],
      };
      this.store.tideSave(code, m);
      this.live.delete(code);
      tell(`${mine}开了一局，第 1 回合等你出牌`);
      this.changed(code);
      return;
    }
    if (!m || m.finishedAt !== null) throw new Error("INVALID");
    if (cmd === "live") {
      if (input.on && !this.bothWatching(code, now)) throw new Error("INVALID");
      if (input.on) this.live.set(code, now + SECONDS * 1000);
      else this.live.delete(code);
      this.changed(code);
      return;
    }
    if (cmd === "abandon") {
      m.finishedAt = now;
      m.updatedAt = now;
      m.ended = "abandoned";
      this.store.tideSave(code, m);
      this.live.delete(code);
      tell(`${mine}结束了这局潮汐棋`);
      this.changed(code);
      return;
    }
    if (input.turn !== m.state.turn) throw new Error("STALE");
    if (cmd === "retract") {
      if (!m.picks[seat] || m.picks[partner]) throw new Error("INVALID");
      m.picks[seat] = null;
    } else if (cmd === "play") {
      const play: Play = { card: input.card, at: input.at, to: input.to };
      if (m.picks[seat] || !validPlay(m.state, seat, play))
        throw new Error("INVALID");
      m.picks[seat] = play;
      if (!m.picks[partner])
        tell(`${mine}出好牌了，第 ${m.state.turn + 1} 回合等你`);
    } else throw new Error("INVALID");
    m.updatedAt = now;
    if (m.picks[0] && m.picks[1]) this.advance(code, m, now, partner);
    this.store.tideSave(code, m);
    this.changed(code);
  }

  /** 结算一回合；tellSeat 是要提醒的人（后出牌那一方的对方），实时超时时不提醒 */
  private advance(code: string, m: AsyncMatch, now: number, tellSeat?: Seat) {
    const turn = m.state.turn;
    m.state = resolve(m.state, m.picks);
    m.picks = [null, null];
    m.updatedAt = now;
    if (m.state.turn >= TURNS) {
      m.finishedAt = now;
      this.live.delete(code);
      if (this.island) {
        const w = winner(m.state);
        m.rewards = [
          this.island.reward(code, 0, w === 0),
          this.island.reward(code, 1, w === 1),
        ];
      }
    } else if (this.live.has(code))
      this.live.set(code, now + REVEAL_MS + SECONDS * 1000);
    if (tellSeat === undefined || this.seen(code, tellSeat, now)) return;
    const names = this.names(code),
      seat = tellSeat,
      other = (1 - seat) as Seat,
      s = m.state.scores;
    this.notify(code, seat, {
      title: "潮汐棋",
      body:
        m.finishedAt !== null
          ? `下完了：你 ${s[seat]} : ${s[other]} ${names[other]}`
          : `第 ${turn + 1} 回合揭晓，你 +${m.state.history.at(-1)!.gained[seat]}，轮到你出第 ${turn + 2} 回合`,
      url: "r/" + code + "#tide",
      tag: "tide-" + code,
    });
  }

  /** 实时模式的计时：超时就按没出牌结算；有人离开就退回异步 */
  tick(now: number) {
    for (const [code, deadline] of this.live) {
      if (!this.bothWatching(code, now)) {
        this.live.delete(code);
        this.changed(code);
        continue;
      }
      if (now <= deadline + 400) continue;
      const m = this.store.tideLatest(code);
      if (!m || m.finishedAt !== null) {
        this.live.delete(code);
        continue;
      }
      this.advance(code, m, now);
      this.store.tideSave(code, m);
      this.changed(code);
    }
  }
}
