import {
  validOptions,
  type ExtraView,
  type ExtraEvent,
  type ExtraId,
  type GameOptions,
} from "./games/types";
export type Seat = 0 | 1;
export const VERSION = 2;
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const AVATARS = ["🐰", "🐻", "🐱", "🐶", "🦊", "🐧"];
export const COLORS = [
  "#FF6B6B",
  "#4D9DFF",
  "#2EC4A6",
  "#FFC93C",
  "#9B7BFF",
  "#FF9A76",
];
export const DECKS = ["轻松", "走心", "未来", "小挑战"] as const;
export type Deck = (typeof DECKS)[number];
export interface Profile {
  nickname: string;
  avatar: string;
  color: string;
}
export interface Settings {
  decks: Deck[];
  limit: 10 | 20 | 0;
  games?: Partial<Record<ExtraId, GameOptions>>;
}
export type Phase =
  | "waiting"
  | "lobby"
  | "proposed"
  | "intro"
  | "countdown"
  | "playing"
  | "paused"
  | "result";
export type ErrCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "BAD_TOKEN"
  | "REPLACED"
  | "VERSION"
  | "NOT_YOUR_TURN"
  | "STALE"
  | "INVALID"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "LOCKED"
  | "NEED_WORDS";
export interface JournalEntry {
  id: string;
  cardId: string;
  question: string;
  text: string;
  seat: Seat;
  at: number;
}
export interface ChatEntry {
  id: string;
  seat: Seat;
  text: string;
  at: number;
}
export interface Card {
  id: string;
  deck: Deck;
  text: string;
}
export interface GameResult {
  primary: { label: string; value: string };
  highlights: string[];
  stats: Record<string, number>;
  aborted?: boolean;
  gameId?: string;
  endedAt?: number;
}
export interface TalkView {
  idx: number;
  turn: Seat;
  phase: "draw" | "shown";
  flipAt: number;
  card: Card | null;
  favorites: [string[], string[]];
  played: number;
  skipped: number;
  remaining: number;
}
export interface RoomView {
  code: string;
  seq: number;
  profiles: [Profile, Profile | null];
  online: [boolean, boolean];
  away: [boolean, boolean];
  phase: Phase;
  proposal: { gameId: string; by: Seat } | null;
  settings: Settings;
  ready: [boolean, boolean];
  startAt: number | null;
  pauseDeadline: number | null;
  rematch: [boolean, boolean];
  result: GameResult | null;
  journal: JournalEntry[];
  journalCount: number;
  favorites: [string[], string[]];
  chat: ChatEntry[];
  restartNotice: boolean;
}
export type Action =
  | { type: "game"; run: string; command: string; payload?: any }
  | { type: "propose"; gameId: string }
  | {
      type:
        | "accept"
        | "decline"
        | "ready"
        | "cancel"
        | "exit"
        | "rematch"
        | "lobby";
    }
  | { type: "settings"; settings: Settings }
  | { type: "profile"; profile: Profile }
  | { type: "draw" }
  | { type: "next" | "skip"; idx: number }
  | { type: "fav"; cardId: string; on: boolean }
  | { type: "answer"; cardId: string; text: string };
export type ClientMessage =
  | { t: "stream"; run: string; kind: "ink" | "cur" | "rt"; data: any }
  | { t: "hello"; code: string; token: string; v: number }
  | { t: "ping"; c: number; rtt: number }
  | { t: "act"; aid: string; a: Action; seq?: number }
  | { t: "chat"; text: string }
  | { t: "react"; e: string }
  | { t: "vis"; hidden: boolean };
export type ServerMessage =
  | { t: "extra"; event: ExtraEvent }
  | {
      t: "welcome";
      seat: Seat;
      now: number;
      room: RoomView;
      game: TalkView | ExtraView | null;
    }
  | { t: "room"; seq: number; room: RoomView }
  | { t: "game"; seq: number; view: TalkView | ExtraView | null }
  | { t: "pong"; c: number; s: number }
  | { t: "ack"; aid: string; ok: boolean; err?: ErrCode }
  | { t: "net"; rtt: [number, number]; pair: number }
  | { t: "presence"; seat: Seat; online: boolean; away: boolean }
  | {
      t: "evt";
      seq: number;
      e: { type: "react"; seat: Seat; emoji: string } | { type: "deleted" };
    }
  | { t: "err"; code: ErrCode; msg: string };
export const errors: Record<ErrCode, string> = {
  ROOM_NOT_FOUND: "房间不存在或已经过期",
  ROOM_FULL: "这个房间已经有两个人啦",
  BAD_TOKEN: "房间凭证已失效，请重新加入",
  REPLACED: "已在其他页面打开",
  VERSION: "页面版本已更新，请刷新后再试",
  NOT_YOUR_TURN: "现在轮到 TA 操作啦",
  LOCKED: "TA 正拿着这块，稍等一下",
  NEED_WORDS: "只选回忆词时，两人需要各自先添加至少三个词",
  STALE: "状态已更新，请再试一次",
  INVALID: "这个操作现在还不能进行",
  RATE_LIMITED: "稍微慢一点，再试一次吧",
  UNAVAILABLE: "这款游戏还在准备中",
};
export function validProfile(p: unknown): p is Profile {
  if (!p || typeof p !== "object") return false;
  const v = p as Profile;
  return (
    typeof v.nickname === "string" &&
    v.nickname.trim().length > 0 &&
    [...v.nickname].length <= 12 &&
    AVATARS.includes(v.avatar) &&
    COLORS.includes(v.color)
  );
}
export function validSettings(s: unknown): s is Settings {
  if (!s || typeof s !== "object") return false;
  const v = s as Settings;
  return (
    Array.isArray(v.decks) &&
    v.decks.length > 0 &&
    v.decks.length <= 4 &&
    new Set(v.decks).size === v.decks.length &&
    v.decks.every((d) => DECKS.includes(d)) &&
    [0, 10, 20].includes(v.limit) &&
    (v.games === undefined ||
      (v.games !== null &&
        typeof v.games === "object" &&
        !Array.isArray(v.games) &&
        Object.entries(v.games).every(([id, opts]) => validOptions(id, opts))))
  );
}
