import type {
  Action,
  Card,
  GameResult,
  Seat,
  Settings,
  TalkView,
  ErrCode,
} from "../../protocol";
import { cards } from "../../content/cards";
import { shuffled } from "../../rng";
export interface TalkState {
  order: string[];
  idx: number;
  turn: Seat;
  phase: "draw" | "shown";
  flipAt: number;
  favorites: [string[], string[]];
  played: number;
  skipped: number;
  discussed: string[];
  limit: number;
}
export function init(
  settings: Settings,
  seed: number,
  seen: string[],
  favorites: [string[], string[]] = [[], []],
): TalkState {
  const available = cards.filter(
    (c) => settings.decks.includes(c.deck) && !seen.includes(c.id),
  );
  return {
    order: shuffled(
      available.map((c) => c.id),
      seed,
    ),
    idx: 0,
    turn: 0,
    phase: "draw",
    flipAt: 0,
    favorites: structuredClone(favorites),
    played: 0,
    skipped: 0,
    discussed: [],
    limit: settings.limit,
  };
}
export function view(s: TalkState): TalkView {
  return {
    idx: s.idx,
    turn: s.turn,
    phase: s.phase,
    flipAt: s.flipAt,
    card:
      s.phase === "shown" ? cards.find((c) => c.id === s.order[s.idx])! : null,
    favorites: structuredClone(s.favorites),
    played: s.played,
    skipped: s.skipped,
    remaining: Math.max(0, s.order.length - s.idx),
  };
}
export function apply(
  s: TalkState,
  seat: Seat,
  a: Action,
  now: number,
): {
  s: TalkState;
  error?: ErrCode;
  answer?: { card: Card; text: string };
  changed?: boolean;
} {
  const fail = (error: ErrCode) => ({ s, error });
  if (a.type === "next" || a.type === "skip") {
    if (a.idx !== s.idx) return { s };
    if (s.phase !== "shown" || now < s.flipAt) return fail("INVALID");
    if (a.type === "skip" && seat !== s.turn) return fail("NOT_YOUR_TURN");
    return {
      s: {
        ...s,
        idx: s.idx + 1,
        turn: a.type === "next" ? ((1 - s.turn) as Seat) : s.turn,
        phase: "draw",
        played: s.played + (a.type === "next" ? 1 : 0),
        skipped: s.skipped + (a.type === "skip" ? 1 : 0),
        discussed:
          a.type === "next" ? [...s.discussed, s.order[s.idx]] : s.discussed,
      },
      changed: true,
    };
  }
  if (a.type === "draw") {
    if (seat !== s.turn) return fail("NOT_YOUR_TURN");
    if (s.phase !== "draw" || s.idx >= s.order.length) return fail("INVALID");
    return { s: { ...s, phase: "shown", flipAt: now + 600 }, changed: true };
  }
  if (a.type === "fav" || a.type === "answer") {
    const current =
      s.phase === "shown" && now >= s.flipAt && a.cardId === s.order[s.idx];
    if (!current && !(a.type === "answer" && s.discussed.includes(a.cardId)))
      return fail("INVALID");
    if (a.type === "fav") {
      if (typeof a.on !== "boolean") return fail("INVALID");
      const favorites = structuredClone(s.favorites);
      favorites[seat] = favorites[seat].filter((id) => id !== a.cardId);
      if (a.on) favorites[seat].push(a.cardId);
      return { s: { ...s, favorites }, changed: true };
    }
    if (
      typeof a.text !== "string" ||
      !a.text.trim() ||
      [...a.text].length > 300
    )
      return fail("INVALID");
    return {
      s,
      answer: {
        card: cards.find((c) => c.id === a.cardId)!,
        text: a.text.trim(),
      },
      changed: true,
    };
  }
  return fail("INVALID");
}
export function result(s: TalkState): GameResult | null {
  if (s.idx < s.order.length && (!s.limit || s.played < s.limit)) return null;
  const common = s.favorites[0].find(
    (id) => s.favorites[1].includes(id) && s.discussed.includes(id),
  );
  return {
    primary: { label: "本局聊了", value: s.played + " 张" },
    highlights: [
      common
        ? "你们都收藏了：「" + cards.find((c) => c.id === common)!.text + "」"
        : "每一次认真倾听，都让我们更靠近一点。",
    ],
    stats: {
      played: s.played,
      favorites: new Set(
        [...s.favorites[0], ...s.favorites[1]].filter((id) =>
          s.discussed.includes(id),
        ),
      ).size,
      skipped: s.skipped,
    },
  };
}
