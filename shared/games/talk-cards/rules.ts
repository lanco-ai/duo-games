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
import { shuffled, mulberry32 } from "../../rng";
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
  seed?: number;
  mode?: "classic" | "pro";
  pro?: {
    trigger: string;
    pool: "truth" | "dare";
    deadline: number;
    outcome: string;
    penalties: [number, number];
  } | null;
}
export function init(
  settings: Settings,
  seed: number,
  seen: string[],
  favorites: [string[], string[]] = [[], []],
): TalkState {
  const available = cards.filter(
    (c) =>
      (settings.talkMode === "pro" || settings.decks.includes(c.deck)) &&
      !seen.includes(c.id),
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
    seed,
    mode: settings.talkMode || "classic",
    pro: null,
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
    pro: s.pro,
    mode: s.mode,
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
  if (a.type === "pro-draw") {
    if (
      s.mode !== "pro" ||
      seat !== s.turn ||
      s.phase !== "draw" ||
      !["wheel", "dice", "joker"].includes(a.trigger) ||
      !["truth", "dare"].includes(a.pool)
    )
      return fail("INVALID");
    const order = [...s.order],
      candidates = order
        .map((id, i) => ({ id, i }))
        .filter(
          (x) =>
            x.i >= s.idx &&
            (cards.find((c) => c.id === x.id)?.deck === "小挑战") ===
              (a.pool === "dare"),
        );
    if (!candidates.length) return fail("UNAVAILABLE");
    const rng = mulberry32((s.seed || 0) + s.idx * 97),
      next = candidates[Math.floor(rng() * candidates.length)].i;
    [order[s.idx], order[next]] = [order[next], order[s.idx]];
    const previous = s.pro?.penalties || [0, 0];
    const result =
      Math.floor(
        rng() * (a.trigger === "dice" ? 6 : a.trigger === "joker" ? 3 : 8),
      ) + 1;
    return {
      s: {
        ...s,
        order,
        phase: "shown",
        flipAt: now + 600,
        pro: {
          trigger: a.trigger + ":" + result,
          pool: a.pool,
          deadline: a.pool === "dare" ? now + 60600 : 0,
          outcome: "",
          penalties: [...previous] as [number, number],
        },
      },
      changed: true,
    };
  }
  if (a.type === "pro-resolve") {
    if (
      s.mode !== "pro" ||
      s.phase !== "shown" ||
      !s.pro ||
      s.pro.pool !== "dare" ||
      seat !== s.turn ||
      s.pro.outcome ||
      !["complete", "drink", "coupon"].includes(a.outcome)
    )
      return fail("INVALID");
    if (a.outcome === "complete" && now >= s.pro.deadline)
      return fail("INVALID");
    const penalties = [...s.pro.penalties] as [number, number];
    if (a.outcome !== "complete") penalties[seat]++;
    return {
      s: { ...s, pro: { ...s.pro, outcome: a.outcome, penalties } },
      changed: true,
    };
  }
  if (a.type === "next" || a.type === "skip") {
    if (a.idx !== s.idx) return { s };
    if (s.phase !== "shown" || now < s.flipAt) return fail("INVALID");
    if (s.mode === "pro" && s.pro?.pool === "dare" && !s.pro.outcome)
      return fail("INVALID");
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
    if (s.mode === "pro") return fail("INVALID");
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
