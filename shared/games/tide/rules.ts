// 潮汐棋规则：纯函数，前后端共用。
//
// 棋盘 6 列 × 7 行，按座位 0 的视角存：第 0–2 行是座位 0 的岸，第 3 行是滩涂，
// 第 4–6 行是座位 1 的岸。离滩涂的行数叫“深度”，滩涂为 0，最靠岸一行为 3。
// 某一侧潮位为 n 时，这一侧深度 ≤ n 的格子在水下（滩涂永远在水下，潮位 3 淹满）。
// 石头会挡住同一列、同一侧、比它更靠岸的格子。
import type { Seat } from "../../protocol";

export const COLS = 6,
  ROWS = 7,
  FLAT = 3,
  TURNS = 12,
  HAND = 4,
  SECONDS = 30;

export type Card = "lamp" | "coral" | "stone" | "boat" | "net" | "wave";
export type PieceKind = "lamp" | "coral" | "stone";
export interface Piece {
  kind: PieceKind;
  owner: Seat;
}
export interface Play {
  card: Card;
  at?: number; // 放置、网的目标格；船的起点
  to?: number; // 船的终点
}
export type Outcome =
  | "ok" // 生效
  | "clash" // 两人同一步抢同一格，都落空
  | "blocked" // 目标格已被占或棋子已不在
  | "missed" // 网没有网到对方棋子
  | "timeout" // 超时，弃掉一张牌
  | "discard"; // 这张牌没有可用目标，直接弃掉
export interface TurnRecord {
  turn: number;
  plays: [Play | null, Play | null];
  outcomes: [Outcome, Outcome];
  captured: number[]; // 被网收走的格子
  tide: [number, number]; // 两侧实际潮位
  gained: [number, number];
  board: (Piece | null)[]; // 结算后的棋盘
}
export interface TideState {
  turn: number; // 0..TURNS，等于 TURNS 时结束
  tides: number[];
  board: (Piece | null)[];
  hands: [Card[], Card[]];
  decks: [Card[], Card[]];
  scores: [number, number];
  history: TurnRecord[];
}

export const CARD_NAMES: Record<Card, string> = {
  lamp: "灯",
  coral: "珊瑚",
  stone: "石",
  boat: "船",
  net: "网",
  wave: "浪",
};
export const BASE_DECK: Card[] = [
  "lamp",
  "lamp",
  "lamp",
  "coral",
  "coral",
  "coral",
  "stone",
  "stone",
  "boat",
  "boat",
  "net",
  "wave",
];

export const row = (cell: number) => Math.floor(cell / COLS);
export const col = (cell: number) => cell % COLS;
export const depth = (cell: number) => Math.abs(row(cell) - FLAT);
/** 格子属于哪一侧的岸；滩涂返回 null */
export function side(cell: number): Seat | null {
  const r = row(cell);
  return r < FLAT ? 0 : r > FLAT ? 1 : null;
}
export function neighbors(cell: number) {
  const r = row(cell),
    c = col(cell),
    out: number[] = [];
  if (r > 0) out.push(cell - COLS);
  if (r < ROWS - 1) out.push(cell + COLS);
  if (c > 0) out.push(cell - 1);
  if (c < COLS - 1) out.push(cell + 1);
  return out;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], random: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 潮汐表：一条起伏的潮线，开局公开。保证出现过 0 和 3。 */
export function tideTable(random: () => number) {
  const period = 5 + random() * 2,
    phase = random() * period;
  const t = Array.from({ length: TURNS }, (_, i) =>
    Math.max(
      0,
      Math.min(
        3,
        Math.round(1.5 + 1.6 * Math.sin((2 * Math.PI * (i + phase)) / period)),
      ),
    ),
  );
  if (!t.includes(0)) t[t.indexOf(Math.min(...t))] = 0;
  if (!t.includes(3)) t[t.indexOf(Math.max(...t))] = 3;
  return t;
}

export function newGame(seed: number): TideState {
  const random = rng(seed);
  const tides = tideTable(random);
  const decks = [shuffle(BASE_DECK, random), shuffle(BASE_DECK, random)] as [
    Card[],
    Card[],
  ];
  return {
    turn: 0,
    tides,
    board: new Array(COLS * ROWS).fill(null),
    hands: [decks[0].splice(0, HAND), decks[1].splice(0, HAND)],
    decks,
    scores: [0, 0],
    history: [],
  };
}

/** 能放灯、珊瑚、石头的空格 */
export function placeTargets(s: TideState, seat: Seat, card: Card) {
  return s.board.flatMap((p, i) =>
    !p && (side(i) === seat || (card !== "stone" && side(i) === null))
      ? [i]
      : [],
  );
}
/** 船：从 from 出发，最多走 2 步（只经过空格）能到的空格 */
export function boatTargets(board: (Piece | null)[], from: number) {
  const seen = new Set([from]),
    out: number[] = [];
  let frontier = [from];
  for (let step = 0; step < 2; step++) {
    const next: number[] = [];
    for (const c of frontier)
      for (const n of neighbors(c))
        if (!seen.has(n) && !board[n]) {
          seen.add(n);
          out.push(n);
          next.push(n);
        }
    frontier = next;
  }
  return out;
}
/** 网：和自己棋子相邻、不是自己棋子的格子（可以猜对方这一回合放哪里） */
export function netTargets(board: (Piece | null)[], seat: Seat) {
  const out = new Set<number>();
  board.forEach((p, i) => {
    if (p?.owner === seat)
      for (const n of neighbors(i)) if (board[n]?.owner !== seat) out.add(n);
  });
  return [...out].sort((a, b) => a - b);
}

/** 这张牌现在有没有能选的目标；没有的话可以直接弃掉，免得异步对局卡住 */
export function hasTarget(s: TideState, seat: Seat, card: Card) {
  if (card === "wave") return true;
  if (card === "net") return netTargets(s.board, seat).length > 0;
  if (card === "boat")
    return s.board.some(
      (p, i) => p?.owner === seat && boatTargets(s.board, i).length > 0,
    );
  return placeTargets(s, seat, card).length > 0;
}

export function validPlay(s: TideState, seat: Seat, play: Play): boolean {
  if (!play || !s.hands[seat].includes(play.card) || s.turn >= TURNS)
    return false;
  if (!hasTarget(s, seat, play.card))
    return play.at === undefined && play.to === undefined;
  const cell = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) < COLS * ROWS;
  switch (play.card) {
    case "lamp":
    case "coral":
    case "stone":
      return (
        cell(play.at) &&
        play.to === undefined &&
        placeTargets(s, seat, play.card).includes(play.at!)
      );
    case "boat":
      return (
        cell(play.at) &&
        cell(play.to) &&
        s.board[play.at!]?.owner === seat &&
        boatTargets(s.board, play.at!).includes(play.to!)
      );
    case "net":
      return (
        cell(play.at) &&
        play.to === undefined &&
        netTargets(s.board, seat).includes(play.at!)
      );
    case "wave":
      return play.at === undefined && play.to === undefined;
  }
}

/** 某格是否在水下（tide 是两侧的实际潮位） */
export function flooded(
  board: (Piece | null)[],
  cell: number,
  tide: [number, number],
) {
  const s = side(cell);
  if (s === null) return true;
  const d = depth(cell);
  if (d > tide[s]) return false;
  // 同一列、同一侧、离滩涂更近的位置有石头，就挡住了水
  for (let k = 1; k < d; k++) {
    const r = s === 0 ? FLAT - k : FLAT + k;
    if (board[r * COLS + col(cell)]?.kind === "stone") return false;
  }
  return true;
}

/**
 * 结算一回合。plays[seat] 为 null 表示超时：弃掉手里最左边一张牌。
 * 顺序：船 → 浪 → 石 → 灯、珊瑚 → 网 → 潮水 → 计分 → 摸牌。
 */
export function resolve(
  s: TideState,
  plays: [Play | null, Play | null],
): TideState {
  const board = [...s.board],
    hands = [[...s.hands[0]], [...s.hands[1]]] as [Card[], Card[]],
    decks = [[...s.decks[0]], [...s.decks[1]]] as [Card[], Card[]],
    outcomes: [Outcome, Outcome] = ["ok", "ok"];
  const seats = [0, 1] as Seat[];
  for (const seat of seats) {
    const play = plays[seat];
    if (play) hands[seat].splice(hands[seat].indexOf(play.card), 1);
    else {
      hands[seat].shift();
      outcomes[seat] = "timeout";
    }
  }
  for (const seat of seats) {
    const play = plays[seat];
    if (play && play.card !== "wave" && play.at === undefined)
      outcomes[seat] = "discard";
  }
  // 弃掉的牌不参与结算
  const of = (card: Card) =>
    seats.filter((x) => plays[x]?.card === card && outcomes[x] !== "discard");

  // 船：都按开始时的棋盘判断；两条船驶向同一格就都停在原地
  const boats = of("boat");
  if (boats.length === 2 && plays[0]!.to === plays[1]!.to)
    boats.forEach((x) => (outcomes[x] = "clash"));
  else
    for (const x of boats) {
      const p = plays[x]!;
      board[p.to!] = board[p.at!];
      board[p.at!] = null;
    }

  // 浪：对方一侧潮位 +1
  const bonus: [number, number] = [0, 0];
  for (const x of of("wave")) bonus[(1 - x) as Seat]++;

  // 放置：先石头，再灯和珊瑚；同一步两人抢同一格就都落空
  for (const group of [["stone"], ["lamp", "coral"]] as Card[][]) {
    const placing = seats.filter(
      (x) =>
        group.includes(plays[x]?.card as Card) && outcomes[x] !== "discard",
    );
    const clash = placing.length === 2 && plays[0]!.at === plays[1]!.at;
    for (const x of placing) {
      const p = plays[x]!;
      if (clash) outcomes[x] = "clash";
      else if (board[p.at!]) outcomes[x] = "blocked";
      else board[p.at!] = { kind: p.card as PieceKind, owner: x };
    }
  }

  // 网：同时判断，再一起收走
  const captured: number[] = [];
  for (const x of of("net")) {
    const at = plays[x]!.at!;
    const hit =
      board[at]?.owner === 1 - x &&
      neighbors(at).some((n) => board[n]?.owner === x);
    if (hit) captured.push(at);
    else outcomes[x] = "missed";
  }
  for (const at of captured) board[at] = null;

  // 潮水与计分
  const level = s.tides[s.turn];
  const tide: [number, number] = [
    Math.min(3, level + bonus[0]),
    Math.min(3, level + bonus[1]),
  ];
  const gained: [number, number] = [0, 0];
  board.forEach((p, i) => {
    if (!p || p.kind === "stone") return;
    const wet = flooded(board, i, tide);
    if ((p.kind === "lamp" && !wet) || (p.kind === "coral" && wet))
      gained[p.owner]++;
  });

  for (const seat of seats) {
    const card = decks[seat].shift();
    if (card) hands[seat].push(card);
  }
  return {
    turn: s.turn + 1,
    tides: s.tides,
    board,
    hands,
    decks,
    scores: [s.scores[0] + gained[0], s.scores[1] + gained[1]],
    history: [
      ...s.history,
      { turn: s.turn, plays, outcomes, captured, tide, gained, board },
    ],
  };
}

/** 赢家：总分高者；同分看最后一回合得分；仍相同为平局（-1） */
export function winner(s: TideState): Seat | -1 {
  if (s.scores[0] !== s.scores[1]) return s.scores[0] > s.scores[1] ? 0 : 1;
  const last = s.history.at(-1)?.gained;
  if (last && last[0] !== last[1]) return last[0] > last[1] ? 0 : 1;
  return -1;
}
