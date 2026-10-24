import type {
  ExtraId,
  GameOptions,
  EngineContext,
  Engine,
} from "../../shared/games/types";
import { MindMeld, KnowMe } from "./conversation";
import { Gomoku } from "./gomoku";
import { DrawGuess } from "./draw";
import { MyEyes } from "./maze";
import { Puzzle } from "./puzzle";
import { Heartbeat } from "./heartbeat";
import { RedThread, HeartBounce } from "./action";
export function createGame(
  id: ExtraId,
  run: string,
  options: GameOptions,
  seed: number,
  at: number,
  ctx: EngineContext,
): Engine {
  const constructor = {
    "mind-meld": MindMeld,
    "know-me": KnowMe,
    gomoku: Gomoku,
    "draw-guess": DrawGuess,
    "my-eyes": MyEyes,
    "puzzle-us": Puzzle,
    heartbeat: Heartbeat,
    "red-thread": RedThread,
    "heart-bounce": HeartBounce,
  }[id];
  return new constructor(run, options, seed, at, ctx);
}
