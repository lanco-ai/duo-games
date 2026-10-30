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
import {
  Survival,
  SpotDifference,
  CoupleLudo,
  CoupleJump,
} from "./couple-puzzles";
import { CoopKitchen, HideSeek } from "./couple-action";
import { LoveSlots } from "./slots";
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
    survival: Survival,
    "spot-difference": SpotDifference,
    "coop-kitchen": CoopKitchen,
    "couple-ludo": CoupleLudo,
    "hide-seek": HideSeek,
    "couple-jump": CoupleJump,
    "love-slots": LoveSlots,
  }[id];
  return new constructor(run, options, seed, at, ctx);
}
