import { it, expect, vi } from "vitest";
import { MyEyes } from "../../server/games/maze";
const make = () =>
  new MyEyes("r", {}, 7, 1000, {
    custom: [],
    seen: [],
    pair: 0,
    imageRatio: 1,
    emit: vi.fn(),
    gallery: vi.fn(),
    seenQuestion: vi.fn(),
  });
it("allows one guide path, crops the maze, expires in two seconds and shifts on pause", () => {
  const g = make(),
    m = g.maze,
    first = g.pos;
  const next = [first - 1, first + 1, first - m.w, first + m.w].find(
    (c) => m.grid[c] === 0,
  )!;
  const p = { round: 0, cells: [first, next] };
  expect(() => g.act(0, "route", p, 1200)).toThrow("NOT_YOUR_TURN");
  g.act(1, "route", p, 1200);
  expect(g.view(0, 1300)).not.toHaveProperty("grid");
  expect(g.view(0, 1300).route?.cells).toEqual(p.cells);
  expect(() => g.act(1, "route", p, 1300)).toThrow("INVALID");
  g.shift(5000);
  expect(g.view(0, 8199).route).not.toBeNull();
  expect(g.view(0, 8200).route).toBeNull();
  g.stage = "complete";
  g.act(0, "next", { round: 0 }, 9000);
  expect(g.routeUsed).toBe(false);
  expect(g.route).toBeNull();
});
it("rejects routes that skip cells, cross walls or do not start at the walker", () => {
  const g = make();
  for (const cells of [
    [g.pos, 0],
    [0, g.pos],
    [g.pos, g.pos + 2],
    [g.pos, g.pos],
  ]) {
    expect(() => g.act(1, "route", { round: 0, cells }, 1001)).toThrow(
      "INVALID",
    );
    expect(g.routeUsed).toBe(false);
  }
});
