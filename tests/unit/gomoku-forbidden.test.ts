import { expect, it, vi } from "vitest";
import { forbiddenMove } from "../../shared/games/gomoku/rules";
import { Gomoku } from "../../server/games/gomoku";
const board = (points: number[][]) => {
  const b = Array(225).fill(-1);
  for (const [x, y] of points) b[y * 15 + x] = 0;
  return b;
};
it("rejects crossing open threes and fours, allows blocked edges and winning moves", () => {
  expect(
    forbiddenMove(
      board([
        [6, 7],
        [8, 7],
        [7, 6],
        [7, 8],
      ]),
      112,
      0,
    ),
  ).toBe("double-three");
  expect(
    forbiddenMove(
      board([
        [5, 7],
        [6, 7],
        [8, 7],
        [7, 5],
        [7, 6],
        [7, 8],
      ]),
      112,
      0,
    ),
  ).toBe("double-four");
  expect(
    forbiddenMove(
      board([
        [1, 0],
        [2, 0],
        [0, 1],
        [0, 2],
      ]),
      0,
      0,
    ),
  ).toBeNull();
  expect(
    forbiddenMove(
      board([
        [3, 7],
        [4, 7],
        [5, 7],
        [6, 7],
        [7, 6],
        [7, 8],
        [6, 6],
        [8, 8],
      ]),
      112,
      0,
    ),
  ).toBeNull();
  // One straight open four has two winning endpoints but counts as one threat.
  expect(
    forbiddenMove(
      board([
        [5, 7],
        [6, 7],
        [8, 7],
      ]),
      112,
      0,
    ),
  ).toBeNull();
});
it("applies only to the initial black player without mutating a rejected move", () => {
  const g = new Gomoku(
    "r",
    { first: "房主", seconds: 0, forbidden: true, wager: "" },
    1,
    0,
    {
      custom: [],
      seen: [],
      pair: 0,
      imageRatio: 1,
      emit: vi.fn(),
      gallery: vi.fn(),
      seenQuestion: vi.fn(),
    },
  );
  g.board = board([
    [6, 7],
    [8, 7],
    [7, 6],
    [7, 8],
  ]);
  expect(() => g.act(0, "place", { move: 0, x: 7, y: 7 }, 1)).toThrow(
    "INVALID",
  );
  expect(g.board[112]).toBe(-1);
  expect(g.moves).toHaveLength(0);
  g.board = g.board.map((v) => (v === 0 ? 1 : v));
  g.turn = 1;
  expect(() => g.act(1, "place", { move: 0, x: 7, y: 7 }, 1)).not.toThrow();
});
it("stores the final five cells for the settlement animation", () => {
  const g = new Gomoku(
    "r",
    { first: "房主", seconds: 0, forbidden: true, wager: "" },
    1,
    0,
    {
      custom: [],
      seen: [],
      pair: 0,
      imageRatio: 1,
      emit: vi.fn(),
      gallery: vi.fn(),
      seenQuestion: vi.fn(),
    },
  );
  g.board = board([
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ]);
  g.place(0, 7, 7, 1);
  expect([0, 1, 2, 3, 4].map((i) => g.result?.stats["win" + i])).toEqual([
    108, 109, 110, 111, 112,
  ]);
});
