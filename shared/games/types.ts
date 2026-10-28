import type { GameResult, Seat } from "../protocol";
export const extraIds = [
  "draw-guess",
  "mind-meld",
  "know-me",
  "gomoku",
  "red-thread",
  "my-eyes",
  "heart-bounce",
  "puzzle-us",
  "heartbeat",
  "survival",
  "spot-difference",
  "coop-kitchen",
  "couple-ludo",
  "hide-seek",
  "couple-jump",
] as const;
export type ExtraId = (typeof extraIds)[number];
export type GameOptions = Record<string, string | number | boolean | string[]>;
export interface ExtraView {
  kind: ExtraId;
  run: string;
  data: Record<string, any>;
}
export interface ExtraEvent {
  run: string;
  kind: string;
  seat?: Seat;
  at: number;
  data: any;
}
export interface GalleryItem {
  id: string;
  kind: string;
  title: string;
  at: number;
  data?: any;
}
export interface CustomItem {
  id: string;
  kind: "word" | "question" | "promise";
  author: Seat;
  data: any;
}
export const defaults: Record<ExtraId, GameOptions> = {
  "draw-guess": { rounds: 6, seconds: 80, libraries: ["日常", "恋爱"] },
  "mind-meld": { seconds: 0 },
  "know-me": {
    count: 10,
    categories: ["吃喝", "习惯", "回忆", "恋爱观", "假如", "未来"],
    unused: true,
    mode: "classic",
  },
  gomoku: { first: "随机", seconds: 0, wager: "请喝奶茶" },
  "red-thread": { level: "1" },
  "my-eyes": {},
  "heart-bounce": {},
  "puzzle-us": { pieces: 24, image: "scene:sunset" },
  heartbeat: { track: "meet" },
  survival: { mode: "mixed" },
  "spot-difference": { scene: 0 },
  "coop-kitchen": { level: "1" },
  "couple-ludo": { mode: "pure" },
  "hide-seek": { mode: "turn" },
  "couple-jump": { mode: "relay", level: "1" },
};
export function isExtra(id: string): id is ExtraId {
  return (extraIds as readonly string[]).includes(id);
}
export function gameOptions(id: ExtraId, values?: GameOptions): GameOptions {
  return { ...defaults[id], ...values };
}
export function validOptions(id: string, value: unknown): value is GameOptions {
  if (
    !isExtra(id) ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    return false;
  const v = value as GameOptions,
    d = defaults[id];
  if (Object.keys(v).some((k) => !(k in d))) return false;
  const o = gameOptions(id, v);
  const array = (key: string, allowed: string[]) =>
    Array.isArray(o[key]) &&
    (o[key] as string[]).length > 0 &&
    (o[key] as string[]).length <= allowed.length &&
    new Set(o[key] as string[]).size === (o[key] as string[]).length &&
    (o[key] as string[]).every((x) => allowed.includes(x));
  switch (id) {
    case "draw-guess":
      return (
        [4, 6, 8].includes(Number(o.rounds)) &&
        [60, 80, 100].includes(Number(o.seconds)) &&
        array("libraries", ["日常", "恋爱", "我们的回忆"])
      );
    case "mind-meld":
      return [0, 30, 60].includes(Number(o.seconds));
    case "know-me":
      return (
        [10, 15, 20].includes(Number(o.count)) &&
        ["classic", "blind"].includes(String(o.mode)) &&
        typeof o.unused === "boolean" &&
        array("categories", ["吃喝", "习惯", "回忆", "恋爱观", "假如", "未来"])
      );
    case "gomoku":
      return (
        ["随机", "房主", "TA"].includes(String(o.first)) &&
        [0, 30, 60].includes(Number(o.seconds)) &&
        typeof o.wager === "string" &&
        [...o.wager].length <= 20
      );
    case "red-thread":
      return ["1", "2", "3", "4", "endless"].includes(String(o.level));
    case "puzzle-us":
      return (
        [24, 48, 96, 150].includes(Number(o.pieces)) &&
        typeof o.image === "string" &&
        /^(scene:(sunset|sakura|stars|cats|city|balloons)|[a-f0-9-]{36})$/.test(
          o.image,
        )
      );
    case "heartbeat":
      return ["meet", "date", "heart"].includes(String(o.track));
    case "survival":
      return ["mixed", "quiz", "search"].includes(String(o.mode));
    case "spot-difference":
      return [0, 1, 2, 3, 4].includes(Number(o.scene));
    case "coop-kitchen":
      return ["1", "2", "3", "4", "5", "endless"].includes(String(o.level));
    case "couple-ludo":
      return ["pure", "warm", "fun"].includes(String(o.mode));
    case "hide-seek":
      return ["turn", "realtime"].includes(String(o.mode));
    case "couple-jump":
      return (
        ["relay", "sync"].includes(String(o.mode)) &&
        ["1", "2", "3", "4", "endless"].includes(String(o.level))
      );
    default:
      return true;
  }
}
export interface EngineContext {
  custom: CustomItem[];
  seen: string[];
  pair: number;
  imageRatio: number;
  gallery: (kind: string, title: string, data: any) => void;
  seenQuestion: (id: string) => void;
  emit: (kind: string, data: any, to?: Seat, disposable?: boolean) => void;
}
export interface Engine {
  id: ExtraId;
  run: string;
  result: GameResult | null;
  view(seat: Seat, now: number): Record<string, any>;
  act(seat: Seat, command: string, payload: any, now: number): boolean;
  tick(now: number): boolean;
  shift(ms: number): void;
  stream?(seat: Seat, kind: string, payload: any, now: number): void;
  data?(seat: Seat, kind: string): any;
  pause?(now: number): void;
  resume?(now: number): void;
}
