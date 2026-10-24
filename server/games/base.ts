import type {
  Engine,
  EngineContext,
  ExtraId,
  GameOptions,
} from "../../shared/games/types";
import type { GameResult, Seat } from "../../shared/protocol";
export abstract class BaseEngine implements Engine {
  result: GameResult | null = null;
  constructor(
    public id: ExtraId,
    public run: string,
    public options: GameOptions,
    public seed: number,
    public startAt: number,
    public ctx: EngineContext,
  ) {}
  abstract view(seat: Seat, now: number): Record<string, any>;
  abstract act(seat: Seat, command: string, payload: any, now: number): boolean;
  tick(_now: number) {
    return false;
  }
  shift(ms: number) {
    this.startAt += ms;
  }
  done(
    label: string,
    value: string,
    highlights: string[],
    stats: Record<string, number>,
  ) {
    if (!this.result)
      this.result = { primary: { label, value }, highlights, stats };
  }
}
