import { describe, expect, it } from "vitest";
import {
  BASE_DECK,
  COLS,
  FLAT,
  TURNS,
  boatTargets,
  flooded,
  netTargets,
  newGame,
  placeTargets,
  resolve,
  validPlay,
  winner,
  type Card,
  type Piece,
  type Play,
  type TideState,
} from "../../shared/games/tide/rules";
import type { Seat } from "../../shared/protocol";

const at = (r: number, c: number) => r * COLS + c;
function withHands(s: TideState, a: Card[], b: Card[]): TideState {
  return { ...s, hands: [a, b] };
}

describe("tide chess rules", () => {
  it("deals 4 cards, keeps 8 in each deck and publishes a 12-turn tide table", () => {
    const s = newGame(7);
    expect(s.hands[0]).toHaveLength(4);
    expect(s.decks[1]).toHaveLength(8);
    expect(s.tides).toHaveLength(TURNS);
    expect(s.tides).toContain(0);
    expect(s.tides).toContain(3);
    expect([...s.hands[0], ...s.decks[0]].sort()).toEqual(
      [...BASE_DECK].sort(),
    );
    expect(newGame(7)).toEqual(s);
  });

  it("floods by depth, keeps the flat wet and lets stones hold back water", () => {
    const board: (Piece | null)[] = new Array(42).fill(null);
    expect(flooded(board, at(FLAT, 0), [0, 0])).toBe(true);
    expect(flooded(board, at(2, 0), [0, 0])).toBe(false);
    expect(flooded(board, at(2, 0), [1, 0])).toBe(true);
    expect(flooded(board, at(0, 0), [2, 3])).toBe(false);
    expect(flooded(board, at(6, 0), [2, 3])).toBe(true);
    board[at(2, 0)] = { kind: "stone", owner: 0 };
    expect(flooded(board, at(1, 0), [3, 3])).toBe(false);
    expect(flooded(board, at(1, 1), [3, 3])).toBe(true);
    // 石头只挡自己这一侧
    expect(flooded(board, at(5, 0), [3, 3])).toBe(true);
  });

  it("limits where each card can go", () => {
    const s = newGame(1);
    expect(placeTargets(s, 0, "lamp")).toContain(at(FLAT, 2));
    expect(placeTargets(s, 0, "lamp")).not.toContain(at(4, 2));
    expect(placeTargets(s, 0, "stone")).not.toContain(at(FLAT, 2));
    expect(placeTargets(s, 1, "stone")).toContain(at(6, 5));
    const board: (Piece | null)[] = new Array(42).fill(null);
    board[at(2, 2)] = { kind: "lamp", owner: 0 };
    board[at(2, 3)] = { kind: "stone", owner: 1 };
    expect(boatTargets(board, at(2, 2))).not.toContain(at(2, 3));
    expect(boatTargets(board, at(2, 2))).toContain(at(FLAT, 3));
    expect(boatTargets(board, at(2, 2))).not.toContain(at(2, 5));
    expect(netTargets(board, 0)).toContain(at(2, 3));
    expect(netTargets(board, 0)).toContain(at(FLAT, 2));
    expect(netTargets(board, 0)).not.toContain(at(2, 2));
  });

  it("scores dry lamps and wet corals after the tide", () => {
    let s = withHands(newGame(3), ["lamp"], ["coral"]);
    s = { ...s, tides: Array(TURNS).fill(1) };
    s = resolve(s, [
      { card: "lamp", at: at(0, 0) },
      { card: "coral", at: at(FLAT, 0) },
    ]);
    expect(s.history[0].gained).toEqual([1, 1]);
    expect(s.scores).toEqual([1, 1]);
  });

  it("makes both cards fizzle when both players take the same cell", () => {
    const s = withHands(newGame(3), ["lamp"], ["coral"]);
    const next = resolve(s, [
      { card: "lamp", at: at(FLAT, 2) },
      { card: "coral", at: at(FLAT, 2) },
    ]);
    expect(next.history[0].outcomes).toEqual(["clash", "clash"]);
    expect(next.board[at(FLAT, 2)]).toBeNull();
  });

  it("moves boats first, so a placement on the boat's landing cell is blocked", () => {
    const s = withHands(newGame(3), ["boat"], ["coral"]);
    const board = [...s.board];
    board[at(2, 2)] = { kind: "lamp", owner: 0 };
    const next = resolve({ ...s, board }, [
      { card: "boat", at: at(2, 2), to: at(FLAT, 2) },
      { card: "coral", at: at(FLAT, 2) },
    ]);
    expect(next.history[0].outcomes).toEqual(["ok", "blocked"]);
    expect(next.board[at(FLAT, 2)]).toEqual({ kind: "lamp", owner: 0 });
  });

  it("raises only the opponent's side with a wave", () => {
    const s = withHands(
      { ...newGame(3), tides: Array(TURNS).fill(1) },
      ["wave"],
      ["wave"],
    );
    const one = resolve(withHands(s, ["wave"], ["coral"]), [
      { card: "wave" },
      { card: "coral", at: at(FLAT, 0) },
    ]);
    expect(one.history[0].tide).toEqual([1, 2]);
    expect(
      resolve(s, [{ card: "wave" }, { card: "wave" }]).history[0].tide,
    ).toEqual([2, 2]);
  });

  it("nets an adjacent piece, including one placed this turn", () => {
    const s = withHands(newGame(3), ["net"], ["coral"]);
    const board = [...s.board];
    board[at(FLAT, 1)] = { kind: "lamp", owner: 0 };
    const next = resolve({ ...s, board }, [
      { card: "net", at: at(FLAT, 2) },
      { card: "coral", at: at(FLAT, 2) },
    ]);
    expect(next.history[0].outcomes[0]).toBe("ok");
    expect(next.history[0].captured).toEqual([at(FLAT, 2)]);
    expect(next.board[at(FLAT, 2)]).toBeNull();
  });

  it("moves a boat before nets are cast, so the net can miss", () => {
    const s = withHands(newGame(3), ["net"], ["boat"]);
    const board = [...s.board];
    board[at(FLAT, 1)] = { kind: "lamp", owner: 0 };
    board[at(FLAT, 2)] = { kind: "coral", owner: 1 };
    const next = resolve({ ...s, board }, [
      { card: "net", at: at(FLAT, 2) },
      { card: "boat", at: at(FLAT, 2), to: at(5, 2) },
    ]);
    expect(next.history[0].outcomes[0]).toBe("missed");
    expect(next.board[at(5, 2)]).toEqual({ kind: "coral", owner: 1 });
  });

  it("discards the leftmost card on a timeout", () => {
    const s = withHands(newGame(3), ["wave", "lamp"], ["boat", "net"]);
    const next = resolve(s, [null, null]);
    expect(next.history[0].outcomes).toEqual(["timeout", "timeout"]);
    expect(next.hands[0].slice(0, 1)).toEqual(["lamp"]);
  });

  it("plays 2000 random games to the end without illegal states", () => {
    let wins = [0, 0, 0];
    for (let seed = 1; seed <= 2000; seed++) {
      let s = newGame(seed);
      let random = seed;
      const pick = <T>(xs: T[]) => {
        random = (random * 1103515245 + 12345) & 0x7fffffff;
        return xs[random % xs.length];
      };
      while (s.turn < TURNS) {
        const plays = ([0, 1] as Seat[]).map((seat) => {
          const options: Play[] = [];
          for (const card of new Set(s.hands[seat])) {
            if (card === "wave") options.push({ card });
            if (card === "lamp" || card === "coral" || card === "stone")
              for (const c of placeTargets(s, seat, card))
                options.push({ card, at: c });
            if (card === "net")
              for (const c of netTargets(s.board, seat))
                options.push({ card, at: c });
            if (card === "boat")
              s.board.forEach((p, i) => {
                if (p?.owner === seat)
                  for (const to of boatTargets(s.board, i))
                    options.push({ card, at: i, to });
              });
          }
          const play = options.length ? pick(options) : null;
          if (play) expect(validPlay(s, seat, play)).toBe(true);
          return play;
        }) as [Play | null, Play | null];
        s = resolve(s, plays);
        expect(s.hands[0].length + s.decks[0].length).toBe(TURNS - s.turn);
      }
      expect(s.hands).toEqual([[], []]);
      wins[winner(s) + 1]++;
      expect(Math.max(...s.scores)).toBeLessThan(80);
    }
    // 随机对局里两边胜率应该接近
    expect(Math.abs(wins[1] - wins[2])).toBeLessThan(200);
  });
});
