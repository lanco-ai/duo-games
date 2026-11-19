import { BaseEngine } from "./base";
import type { Seat } from "../../shared/protocol";
import type { EngineContext, GameOptions } from "../../shared/games/types";
import {
  CARD_NAMES,
  SECONDS,
  TURNS,
  newGame,
  resolve,
  validPlay,
  winner,
  type Play,
  type TideState,
} from "../../shared/games/tide/rules";

// 揭晓后留给两人看结算动画的时间，再开始下一回合的倒计时
const REVEAL_MS = 3000;

export class TideChess extends BaseEngine {
  state: TideState;
  picks: [Play | null, Play | null] = [null, null];
  deadline: number;
  constructor(
    run: string,
    o: GameOptions,
    seed: number,
    at: number,
    c: EngineContext,
  ) {
    super("tide-chess", run, o, seed, at, c);
    this.state = newGame(seed);
    this.deadline = at + SECONDS * 1000;
  }
  view(seat: Seat) {
    const s = this.state,
      other = (1 - seat) as Seat;
    return {
      turn: s.turn,
      tides: s.tides,
      board: s.board,
      hand: s.hands[seat],
      deck: s.decks[seat].length,
      otherHand: s.hands[other].length,
      scores: s.scores,
      picked: [!!this.picks[0], !!this.picks[1]],
      pick: this.picks[seat],
      last: s.history.at(-1) ?? null,
      deadline: this.deadline,
    };
  }
  act(seat: Seat, cmd: string, p: any, now: number) {
    if (this.result || p?.turn !== this.state.turn) throw new Error("STALE");
    if (cmd === "play") {
      const play: Play = { card: p.card, at: p.at, to: p.to };
      if (!validPlay(this.state, seat, play)) throw new Error("INVALID");
      this.picks[seat] = play;
      if (this.picks[0] && this.picks[1]) this.advance(now);
      return true;
    }
    if (cmd === "retract") {
      if (!this.picks[seat]) throw new Error("INVALID");
      this.picks[seat] = null;
      return true;
    }
    throw new Error("INVALID");
  }
  advance(now: number) {
    this.state = resolve(this.state, this.picks);
    this.picks = [null, null];
    this.deadline = now + REVEAL_MS + SECONDS * 1000;
    if (this.state.turn < TURNS) return;
    const s = this.state,
      w = winner(s);
    const count = (seat: Seat, card: string) =>
      s.history.filter((h) => h.plays[seat]?.card === card).length;
    this.done(
      w < 0 ? "平分秋色" : "潮水退去",
      `${s.scores[0]} : ${s.scores[1]}`,
      [
        w < 0
          ? "一样多的光，一样深的海。"
          : s.scores[0] !== s.scores[1]
            ? `玩家 ${w + 1} 赢了 ${Math.abs(s.scores[0] - s.scores[1])} 分`
            : `同分，玩家 ${w + 1} 最后一回合拿得更多`,
        `打得最多的牌：${
          CARD_NAMES[
            (["lamp", "coral", "stone", "boat", "net", "wave"] as const).reduce(
              (a, b) =>
                count(0, b) + count(1, b) > count(0, a) + count(1, a) ? b : a,
            )
          ]
        }`,
      ],
      { winner: w, score0: s.scores[0], score1: s.scores[1] },
    );
  }
  tick(now: number) {
    if (this.result || now <= this.deadline + 400) return false;
    this.advance(now);
    return true;
  }
  shift(ms: number) {
    super.shift(ms);
    this.deadline += ms;
  }
}
