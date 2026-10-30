import { describe, it, expect, vi } from "vitest";
import { MyEyes, makeMaze, ghostCell } from "../../server/games/maze";
import { LoveSlots } from "../../server/games/slots";
import {
  judge,
  stripAt,
  strip,
  STOP2,
  AUTO_STOP,
} from "../../shared/games/love-slots/rules";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: [],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
});
function solve(m: ReturnType<typeof makeMaze>) {
  const prev = new Map<number, number>([[m.start, -1]]),
    queue = [m.start];
  for (let i = 0; i < queue.length; i++)
    for (const d of [-m.w, 1, m.w, -1]) {
      const c = queue[i],
        n = c + d;
      if (
        (d === 1 && n % m.w === 0) ||
        (d === -1 && c % m.w === 0) ||
        n < 0 ||
        n >= m.grid.length ||
        m.grid[n] ||
        prev.has(n)
      )
        continue;
      prev.set(n, c);
      queue.push(n);
    }
  const path: number[] = [];
  for (let c = m.exit; c !== -1; c = prev.get(c)!) path.unshift(c);
  return path;
}
describe("my-eyes hearts and ghosts", () => {
  it("places hearts on open cells and keeps ghost lanes off the critical path for many seeds", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (let round = 0; round < 6; round++) {
        const m = makeMaze(round, seed),
          path = new Set(solve(m));
        expect(m.hearts.length).toBe([1, 2, 3, 3, 3, 3][round]);
        expect(new Set(m.hearts).size).toBe(m.hearts.length);
        for (const c of m.hearts) {
          expect([m.start, m.exit, m.key, m.door]).not.toContain(c);
          expect(m.grid[c]).toBe(0);
          expect(m.traps).not.toContain(c);
        }
        if (round < 2) expect(m.ghosts).toHaveLength(0);
        for (const lane of m.ghosts) {
          expect(lane.length).toBeGreaterThanOrEqual(2);
          for (const c of lane) expect(path.has(c)).toBe(false);
          for (let i = 1; i < lane.length; i++)
            expect(
              Math.abs((lane[i] % m.w) - (lane[i - 1] % m.w)) +
                Math.abs(
                  Math.floor(lane[i] / m.w) - Math.floor(lane[i - 1] / m.w),
                ),
            ).toBe(1);
        }
      }
  });
  it("ping-pongs along a lane", () => {
    const lane = [5, 6, 7];
    expect(
      [0, 1, 2, 3, 4, 5].map((s) => ghostCell(lane, s * 100, 100)),
    ).toEqual([5, 6, 7, 6, 5, 6]);
  });
  it("collects hearts, hides the full heart list from the walker and scares back", () => {
    const g = new MyEyes("r", {}, 3, 0, ctx());
    g.round = 2;
    g.maze = makeMaze(2, 99);
    g.pos = g.maze.start;
    expect(g.view(0, 0)).not.toHaveProperty("hearts");
    expect(g.view(0, 0)).not.toHaveProperty("ghosts");
    expect((g.view(1, 0) as any).hearts).toEqual(g.maze.hearts);
    // Teleport beside a heart and step onto it.
    const heart = g.maze.hearts[0],
      from = [heart - 1, heart + 1, heart - g.maze.w, heart + g.maze.w].find(
        (c) => g.maze.grid[c] === 0,
      )!;
    g.pos = from;
    const dir = [-g.maze.w, 1, g.maze.w, -1].indexOf(heart - from);
    g.trail = [g.maze.start];
    g.roundStart = -1e9; // ghosts far along their lanes; may or may not be here
    g.safeUntil = Infinity;
    g.act(0, "move", { round: 2, n: 0, dir }, 0);
    expect(g.heartTotal).toBe(1);
    expect(g.view(0, 0).got).toContain(heart);
    // A ghost landing on the walker knocks them back along the trail.
    const lane = g.maze.ghosts[0];
    g.safeUntil = 0;
    g.pos = lane[0];
    g.trail = [10, 11, 12, 13];
    g.roundStart = 0;
    expect(g.scare(0)).toBe(true);
    expect(g.pos).toBe(11);
    expect(g.scares).toBe(1);
    expect(g.scare(100)).toBe(false); // short immunity
  });
  it("walker can reply to the guide but guide cannot use replies", () => {
    const g = new MyEyes("r", {}, 3, 0, ctx());
    g.act(0, "reply", { round: 0, text: "收到！" }, 10);
    expect(g.view(1, 20).reply?.text).toBe("收到！");
    expect(() => g.act(1, "reply", { round: 0, text: "收到！" }, 30)).toThrow(
      "NOT_YOUR_TURN",
    );
    expect(() => g.act(0, "reply", { round: 0, text: "hi" }, 40)).toThrow(
      "INVALID",
    );
  });
});
describe("love-slots", () => {
  it("judges jackpots, triples, pairs and heartbreak", () => {
    expect(judge(["💗", "💗", "💗"], 0)).toMatchObject({
      mult: 10,
      jackpot: true,
      wish: true,
    });
    expect(judge(["🌹", "🌹", "🌹"], 0).mult).toBe(6);
    expect(judge(["🌹", "🍰", "🌹"], 0).mult).toBe(2);
    expect(judge(["💗", "🍰", "💗"], 0).mult).toBe(3);
    expect(judge(["💔", "🍰", "🌹"], 0)).toMatchObject({ mult: 0, penalty: 1 });
    expect(judge(["⭐", "🍰", "🌹"], 0).mult).toBe(0);
    expect(judge(["⭐", "💗", "🌹"], 0).mult).toBe(1);
  });
  it("third reel symbol follows the partner's tap time", () => {
    expect(stripAt(0, 0)).toBe(strip[0]);
    expect(stripAt(2, 170 * 3 + 5)).toBe(strip[5]);
  });
  it("plays a full game with turns, partner stop, task confirmation and result", () => {
    const g = new LoveSlots("r", { pulls: 6 }, 4, 0, ctx());
    let t = 0;
    while (!g.result) {
      const puller = g.turn,
        partner = (1 - puller) as 0 | 1;
      expect(() => g.act(partner, "spin", { pull: g.pull, bet: 1 }, t)).toThrow(
        "NOT_YOUR_TURN",
      );
      g.act(puller, "spin", { pull: g.pull, bet: 1 }, t);
      expect(g.view(partner, t + 10).reels).toEqual([null, null, null]);
      expect(() =>
        g.act(puller, "stop", { pull: g.pull, at: t + 3000 }, t + 3000),
      ).toThrow("NOT_YOUR_TURN");
      expect(() =>
        g.act(partner, "stop", { pull: g.pull, at: t + 100 }, t + 100),
      ).toThrow("TOO_EARLY");
      g.act(partner, "stop", { pull: g.pull, at: t + 2500 }, t + 2600);
      expect(g.phase).toBe("task");
      expect(g.stopped).toBe(stripAt(g.offset, 2500));
      const target = g.outcome!.card.target,
        doer = target === "puller" ? puller : partner,
        verifier = target === "both" ? puller : ((1 - doer) as 0 | 1);
      g.act(verifier, "done", { pull: g.pull }, t + 3000);
      t += 5000;
    }
    expect(g.result.stats.pulls).toBeGreaterThan(0);
    expect(g.result.stats.sweet).toBe(g.result.stats.pulls);
  });
  it("auto-stops the third reel and respects pause shifts", () => {
    const g = new LoveSlots("r", {}, 1, 0, ctx());
    g.act(g.turn, "spin", { pull: 0, bet: 2 }, 1000);
    expect(g.coins).toBe(18);
    g.shift(4000);
    expect(g.tick(1000 + 4000 + STOP2)).toBe(true);
    expect(g.phase).toBe("spinning");
    g.tick(1000 + 4000 + AUTO_STOP);
    expect(g.phase).toBe("task");
    expect(g.stopped).toBe(stripAt(g.offset, AUTO_STOP));
  });
  it("skipping costs coins and running out ends the game", () => {
    const g = new LoveSlots("r", {}, 2, 0, ctx());
    g.coins = 1;
    g.act(g.turn, "spin", { pull: 0, bet: 1 }, 0);
    g.tick(AUTO_STOP);
    const o = g.outcome!;
    g.coins = 1;
    const doer = o.card.target === "partner" ? 1 - g.turn : g.turn;
    g.act(doer as 0 | 1, "skip", { pull: 0 }, AUTO_STOP + 10);
    expect(g.coins).toBe(0);
    expect(g.result?.primary.label).toBe("爱情破产，但还有彼此");
  });
});
