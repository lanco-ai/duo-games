import { describe, it, expect, vi, afterEach } from "vitest";
import { MindMeld, KnowMe } from "../../server/games/conversation";
import { DrawGuess } from "../../server/games/draw";
import { Gomoku } from "../../server/games/gomoku";
import { MyEyes, makeMaze } from "../../server/games/maze";
import { Puzzle } from "../../server/games/puzzle";
import { Heartbeat } from "../../server/games/heartbeat";
import { HeartBounce, RedThread } from "../../server/games/action";
import {
  defaults,
  extraIds,
  type EngineContext,
} from "../../shared/games/types";
import { words } from "../../shared/content/words";
import { questions } from "../../shared/content/questions";
import { frames, Assembler } from "../../shared/wire";
import { grade } from "../../shared/games/heartbeat/chart";
import * as ball from "../../shared/games/heart-bounce/sim";
import * as red from "../../shared/games/red-thread/sim";
import { RoomManager, type Peer } from "../../server/rooms";
import { Store } from "../../server/store";
import type { Seat, ServerMessage } from "../../shared/protocol";
function ctx(): EngineContext {
  return {
    custom: [],
    seen: [],
    pair: 250,
    imageRatio: 1.5,
    gallery: vi.fn(),
    seenQuestion: vi.fn(),
    emit: vi.fn(),
  };
}
afterEach(() => vi.useRealTimers());
describe("all nine games enforce rules, protect private views and reach a result", () => {
  it("contains 420 unique drawing words and 150 questions in six categories", () => {
    expect(words.filter((w) => w.library === "日常")).toHaveLength(300);
    expect(words.filter((w) => w.library === "恋爱")).toHaveLength(120);
    expect(new Set(words.map((w) => w.w)).size).toBe(420);
    expect(questions).toHaveLength(150);
    expect(new Set(questions.map((q) => q.id)).size).toBe(150);
    expect(new Set(questions.map((q) => q.cat)).size).toBe(6);
  });
  it("keeps committed words hidden; locks each answer and reveals atomically", () => {
    const g = new MindMeld("run", defaults["mind-meld"], 1, 1000, ctx());
    g.act(0, "submit", { round: 0, word: "咖啡" }, 1000);
    expect(g.view(1).answers).toBeNull();
    expect(JSON.stringify(g.view(1))).not.toContain("咖啡");
    expect(() =>
      g.act(0, "submit", { round: 0, word: "奶茶" }, 1100),
    ).toThrow();
    g.act(1, "submit", { round: 0, word: "咖啡" }, 1200);
    expect(g.view(0).revealAt).toBe(2000);
    expect(g.tick(1999)).toBe(false);
    g.tick(2000);
    expect(g.result?.stats.success).toBe(1);
  });
  it("allows both players to agree after the tenth unequal word pair", () => {
    const g = new MindMeld("run", defaults["mind-meld"], 1, 0, ctx());
    for (let i = 0; i < 10; i++) {
      const suffix = String.fromCharCode(97 + i);
      g.act(0, "submit", { round: i, word: "a" + suffix }, i * 2000);
      g.act(1, "submit", { round: i, word: "b" + suffix }, i * 2000);
      g.tick(i * 2000 + 800);
    }
    expect(g.result).toBeNull();
    g.act(0, "agree", { round: 10 }, 21000);
    g.act(1, "agree", { round: 10 }, 21001);
    expect(g.result?.stats.success).toBe(1);
  });
  it("scores all four question formats and persists ten played question ids", () => {
    const c = ctx(),
      g = new KnowMe(
        "run",
        { ...defaults["know-me"], unused: false },
        31,
        0,
        c,
      );
    for (let idx = 0; idx < 10; idx++) {
      const q = g.view(0).question,
        a =
          q.type === "choice"
            ? 2
            : q.type === "slider"
              ? 60
              : q.type === "rank"
                ? [2, 0, 1, 3]
                : "奶茶";
      g.act(0, "submit", { idx, answer: a }, idx * 2000);
      expect(g.view(1).own).toBeNull();
      expect(g.view(1).answers).toBeNull();
      g.act(1, "submit", { idx, answer: a }, idx * 2000);
      g.tick(idx * 2000 + 801);
      if (q.type === "text") {
        expect(() =>
          g.act(
            (1 - (g.idx % 2)) as Seat,
            "grade",
            { idx, score: 10 },
            idx * 2000 + 900,
          ),
        ).toThrow();
        g.act(
          (g.idx % 2) as Seat,
          "grade",
          { idx, score: 10 },
          idx * 2000 + 900,
        );
      }
      g.act(0, "next", { idx }, idx * 2000 + 1000);
    }
    expect(g.result?.stats.percent).toBe(100);
    expect(c.seenQuestion).toHaveBeenCalledTimes(10);
    expect(g.result?.highlights).toEqual(["每一道都猜中了，今天也很懂彼此。"]);
  });
  it("plays four drawing rounds, hides choices, validates streams, deduplicates stroke chunks, and accepts 400ms deadline grace once", () => {
    const c = ctx(),
      g = new DrawGuess(
        "run",
        { ...defaults["draw-guess"], rounds: 4 },
        2,
        0,
        c,
      );
    let now = 0;
    for (let round = 0; round < 4; round++) {
      const drawer = (round % 2) as Seat,
        guesser = (1 - drawer) as Seat;
      expect(g.view(guesser, now).choices).toBeNull();
      g.act(drawer, "choose", { round, index: 2 }, now);
      expect(g.view(guesser, now).answer).toBeNull();
      g.stream(
        drawer,
        "ink",
        { round, op: "start", id: "stroke", color: "#F05267", size: 10 },
        now,
      );
      const points = {
        round,
        op: "points",
        id: "stroke",
        offset: 0,
        points: [100, 100, 500, 600],
      };
      g.stream(drawer, "ink", points, now + 10);
      g.stream(drawer, "ink", points, now + 10);
      expect(g.strokes[0].points).toHaveLength(4);
      g.stream(guesser, "ink", { round, op: "start", id: "fake" }, now);
      expect(g.strokes).toHaveLength(1);
      g.act(guesser, "guess", { round, text: g.answer!.w }, g.deadline + 400);
      expect(g.phase).toBe("reveal");
      expect(() =>
        g.act(guesser, "guess", { round, text: g.answer!.w }, g.deadline),
      ).toThrow();
      now = g.deadline;
      g.tick(now);
    }
    expect(g.result?.stats.rounds).toBe(4);
    expect(c.gallery).toHaveBeenCalledTimes(4);
  });
  it("custom drawing words remain author-only and require three words per player", () => {
    const c = ctx();
    c.custom = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      kind: "word",
      author: (i % 2) as Seat,
      data: { word: (i % 2 ? "私密乙" : "私密甲") + i },
    }));
    const g = new DrawGuess(
      "r",
      { ...defaults["draw-guess"], libraries: ["我们的回忆"] },
      1,
      0,
      c,
    );
    expect(g.choice.every((w) => w.w.startsWith("私密甲"))).toBe(true);
    expect(JSON.stringify(g.view(1, 0))).not.toContain("私密甲");
    c.custom.pop();
    expect(
      () =>
        new DrawGuess(
          "r",
          { ...defaults["draw-guess"], libraries: ["我们的回忆"] },
          1,
          0,
          c,
        ),
    ).toThrow("NEED_WORDS");
  });
  it("gomoku rejects stale occupied or out-of-turn moves and requires the partner for undo", () => {
    const g = new Gomoku(
      "r",
      { ...defaults.gomoku, first: "房主", seconds: 30 },
      1,
      0,
      ctx(),
    );
    g.act(0, "place", { move: 0, x: 7, y: 7 }, 100);
    expect(() => g.act(0, "place", { move: 1, x: 7, y: 8 }, 200)).toThrow(
      "NOT_YOUR_TURN",
    );
    g.act(0, "undo", {}, 200);
    expect(() => g.act(0, "accept", {}, 201)).toThrow();
    g.act(1, "accept", {}, 202);
    expect(g.moves).toHaveLength(0);
    expect(g.turn).toBe(0);
    expect(() =>
      g.act(0, "place", { move: 0, x: 1, y: 1 }, g.deadline + 401),
    ).toThrow("STALE");
    g.tick(g.deadline + 401);
    expect(g.moves).toHaveLength(1);
  });
  it("gomoku detects diagonal five and produces one winner", () => {
    const g = new Gomoku(
      "r",
      { ...defaults.gomoku, first: "房主" },
      1,
      0,
      ctx(),
    );
    for (let i = 0; i < 5; i++) {
      g.act(0, "place", { move: g.moves.length, x: i, y: i }, 0);
      if (i < 4) g.act(1, "place", { move: g.moves.length, x: i, y: 14 }, 0);
    }
    expect(g.result?.stats.winner).toBe(0);
    expect(g.line).toHaveLength(5);
  });
  it("maze critical path remains solvable with key before door over all six rounds and 40 seeds", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (let round = 0; round < 6; round++) {
        const m = makeMaze(round, seed),
          path = solve(m);
        expect(path.at(-1)).toBe(m.exit);
        if (round >= 3)
          expect(path.indexOf(m.key)).toBeLessThan(path.indexOf(m.door));
        if (round >= 2) expect(m.traps.length).toBeGreaterThan(0);
      }
  });
  it("maze never sends the walker the seed/map/traps, swaps roles, and finishes six rounds", () => {
    const g = new MyEyes("r", {}, 15, 0, ctx());
    for (let round = 0; round < 6; round++) {
      const walker = (round % 2) as Seat,
        v = g.view(walker, 0);
      for (const key of ["seed", "grid", "traps"])
        expect(v).not.toHaveProperty(key);
      const route = solve(g.maze);
      let previous = g.pos;
      route.slice(1).forEach((cell, n) => {
        const delta = cell - previous,
          dir = delta === 1 ? 1 : delta === -1 ? 3 : delta === g.maze.w ? 2 : 0;
        g.act(walker, "move", { round, n, dir }, 1000 + n * 200);
        previous = cell;
      });
      expect(g.stage).toBe("complete");
      g.act(walker, "next", { round }, 20000 + round * 20000);
    }
    expect(g.result?.stats.rounds).toBe(6);
  });
  it("puzzle locks exclude the partner, renew and expire, and completed merges stay exactly at the image origin", () => {
    const g = new Puzzle("r", defaults["puzzle-us"], 1, 0, ctx());
    g.act(0, "grab", { gid: 0 }, 0);
    expect(() => g.act(1, "grab", { gid: 0 }, 1)).toThrow("LOCKED");
    g.stream(0, "cur", { op: "move", gid: 0, x: 10, y: 20 }, 2000);
    g.tick(4000);
    expect(g.groups[0].lockedBy).toBe(0);
    g.tick(5001);
    g.act(1, "grab", { gid: 0 }, 5002);
    g.act(1, "drop", { gid: 0, x: 0, y: 0 }, 5003);
    let count = 0;
    while (!g.result && count++ < 24) {
      const group = g.groups.find((x) => !x.placed)!;
      g.act(0, "grab", { gid: group.id }, 6000 + count);
      g.act(0, "drop", { gid: group.id, x: 0, y: 0 }, 6000 + count);
    }
    expect(g.result?.stats.pieces).toBe(24);
    expect(g.counts[0] + g.counts[1]).toBe(24);
    expect(g.groups.every((x) => x.x === 0 && x.y === 0)).toBe(true);
  });
  it("heartbeat judges 45/90/135ms boundaries locally, combines complementary tracks and counts missing notes as misses", () => {
    expect([-136, -135, -90, -45, 45, 90, 135, 136].map(grade)).toEqual([
      0, 1, 2, 3, 3, 2, 1, 0,
    ]);
    const g = new Heartbeat("r", defaults.heartbeat, 1, 0, ctx());
    for (const note of g.song.notes)
      for (const seat of note.seats)
        g.act(seat as Seat, "results", { entries: [[note.id, 3]] }, note.ms);
    g.tick(g.song.duration + 5000);
    expect(g.result?.stats.sync).toBe(100);
    expect(g.result?.stats.accuracy0).toBe(100);
    const missed = new Heartbeat("r", defaults.heartbeat, 1, 0, ctx());
    missed.tick(missed.song.duration + 5000);
    expect(missed.result?.stats.accuracy0).toBe(0);
  });
  it("bounce alternates owners, rejects duplicate hits and settles only one miss per flight", () => {
    const g = new HeartBounce("r", {}, 9, 0, ctx());
    for (let i = 0; i < 10; i++) {
      const tick = ball.paddleTick(g.hit),
        x = ball.ballAt(g.hit, tick).x / 256,
        old = g.hit.n,
        owner = g.owner;
      g.act(
        owner,
        "hit",
        { epoch: g.epoch, n: old, tick, x },
        (tick / 60) * 1000,
      );
      expect(g.owner).toBe(1 - owner);
      expect(() =>
        g.act(
          owner,
          "hit",
          { epoch: g.epoch, n: old, tick, x },
          (tick / 60) * 1000,
        ),
      ).toThrow("STALE");
    }
    expect(g.best).toBe(10);
    while (!g.result) {
      const tick = ball.missTick(g.hit);
      g.act(
        g.owner,
        "miss",
        { epoch: g.epoch, n: g.hit.n, tick },
        (tick / 60) * 1000,
      );
    }
    expect(g.lives).toBe(0);
    expect(g.result?.stats.best).toBe(10);
  });
  it("bounce only penalizes a disconnected owner; backgrounding and non-owner disconnect do not lose a life", () => {
    const g = new HeartBounce("r", {}, 9, 0, ctx());
    g.pause(500);
    g.ownerDisconnected(1, 500);
    g.tick(10000);
    expect(g.lives).toBe(3);
    g.ownerDisconnected(0, 10000);
    g.tick(20000);
    g.tick(30000);
    expect(g.lives).toBe(2);
    g.resume();
    expect(g.paused).toBe(false);
  });
  it("red server confirms the same integer state, rejects changed frames and fences pause epochs", () => {
    const g = new RedThread("r", defaults["red-thread"], 7, 0, ctx()),
      expected = red.init(g.level);
    for (let t = 0; t < 600; t++) {
      const bits = t < g.inputDelay ? 0 : t % 50 < 2 ? 4 : t % 100 < 50 ? 2 : 1;
      for (const seat of [0, 1] as Seat[])
        g.stream(
          seat,
          "rt",
          { epoch: 0, frames: [[t, bits]] },
          (t / 60) * 1000,
        );
      red.step(expected, [bits, bits], g.level);
    }
    expect(red.hash(g.state)).toBe(red.hash(expected));
    expect(() =>
      g.stream(0, "rt", { epoch: 0, frames: [[599, 31]] }, 10000),
    ).toThrow();
    g.pause();
    const tick = g.state[0];
    g.stream(0, "rt", { epoch: 0, frames: [[tick, 31]] }, 10000);
    expect(g.logs[0].get(tick)).toBe(0);
    expect(g.epoch).toBe(1);
  });
});
function solve(m: ReturnType<typeof makeMaze>) {
  const queue = [m.start],
    prev = new Map([[m.start, -1]]);
  for (let i = 0; i < queue.length; i++)
    for (const delta of [-m.w, 1, m.w, -1]) {
      const cell = queue[i] + delta;
      if (
        cell >= 0 &&
        cell < m.grid.length &&
        !m.grid[cell] &&
        !m.traps.includes(cell) &&
        !prev.has(cell)
      ) {
        prev.set(cell, queue[i]);
        queue.push(cell);
      }
    }
  const path: number[] = [];
  for (let c = m.exit; c !== -1; c = prev.get(c) ?? -1) path.unshift(c);
  return path;
}
describe("shared platform with all games", () => {
  it("segments large unicode snapshots into under-16KB frames and reassembles without leaking partial state", () => {
    const message = { t: "game", data: "你好🐰".repeat(10000) },
      packets = frames(message, "test"),
      a = new Assembler();
    expect(packets.length).toBeGreaterThan(1);
    let result: any;
    for (const packet of packets) {
      expect(Buffer.byteLength(packet)).toBeLessThan(16384);
      const v = a.accept(JSON.parse(packet));
      if (v) result = v;
    }
    expect(result).toEqual(message);
  });
  it.each(extraIds)(
    "starts %s, sends per-seat welcome, and persists its final result once",
    (id) => {
      vi.useFakeTimers();
      const { m, r, store, peer } = platform();
      m.act(r, 0, "propose-x1", { type: "propose", gameId: id });
      m.act(r, 1, "accept-xx1", { type: "accept" });
      m.act(r, 0, "ready-xxx0", { type: "ready" });
      m.act(r, 1, "ready-xxx1", { type: "ready" });
      vi.advanceTimersByTime(3500);
      expect(r.view.phase).toBe("playing");
      expect(r.extra?.id).toBe(id);
      const events: ServerMessage[] = [];
      m.connect(r, 1, peer(events));
      const welcome = events.find((x) => x.t === "welcome") as any;
      expect(welcome.game.kind).toBe(id);
      if (id === "draw-guess") expect(welcome.game.data.choices).toBeNull();
      if (id === "my-eyes")
        expect((m.gameView(r, 0) as any)?.data).not.toHaveProperty("grid");
      m.finish(r, false, {
        primary: { label: "done", value: "1" },
        highlights: [],
        stats: {},
      });
      m.finish(r, false, {
        primary: { label: "duplicate", value: "2" },
        highlights: [],
        stats: {},
      });
      expect(store.history(r.data.code)).toHaveLength(1);
      m.close();
    },
  );
  it("recovers non-action games when one player returns from background after the partner reconnects", () => {
    vi.useFakeTimers();
    const { m, r, peer } = platform();
    m.act(r, 0, "propose-x1", { type: "propose", gameId: "gomoku" });
    m.act(r, 1, "accept-xx1", { type: "accept" });
    m.act(r, 0, "ready-xxx0", { type: "ready" });
    m.act(r, 1, "ready-xxx1", { type: "ready" });
    vi.advanceTimersByTime(3500);
    m.visibility(r, 0, true);
    m.disconnect(r, 1, r.peers[1]!);
    m.connect(r, 1, peer([]));
    expect(r.view.phase).toBe("paused");
    m.visibility(r, 0, false);
    vi.advanceTimersByTime(3500);
    expect(r.view.phase).toBe("playing");
    m.close();
  });
  it("does not launch realtime games when a ready player has gone to background; heartbeat keeps playing offline", () => {
    vi.useFakeTimers();
    const { m, r } = platform();
    m.act(r, 0, "propose-x1", { type: "propose", gameId: "red-thread" });
    m.act(r, 1, "accept-xx1", { type: "accept" });
    m.act(r, 0, "ready-xxx0", { type: "ready" });
    m.visibility(r, 0, true);
    m.act(r, 1, "ready-xxx1", { type: "ready" });
    expect(r.view.phase).toBe("intro");
    m.visibility(r, 0, false);
    m.act(r, 0, "cancel-xxx", { type: "cancel" });
    m.act(r, 0, "propose-x2", { type: "propose", gameId: "heartbeat" });
    m.act(r, 1, "accept-xx2", { type: "accept" });
    m.act(r, 0, "ready-xxx2", { type: "ready" });
    m.act(r, 1, "ready-xxx3", { type: "ready" });
    vi.advanceTimersByTime(3500);
    m.disconnect(r, 1, r.peers[1]!);
    expect(r.view.phase).toBe("playing");
    m.close();
  });
});
function platform() {
  const store = new Store(":memory:"),
    m = new RoomManager(store),
    host = m.create({ nickname: "甲", avatar: "🐰", color: "#FF6B6B" });
  m.join(host.code, { nickname: "乙", avatar: "🐻", color: "#4D9DFF" });
  const r = m.require(host.code),
    peer = (events: ServerMessage[] = []): Peer => ({
      send: (x) => events.push(structuredClone(x)),
      close: () => {},
      rtt: 0,
      lastSeen: Date.now(),
    });
  m.connect(r, 0, peer());
  m.connect(r, 1, peer());
  return { store, m, r, peer };
}
it("a paused bounce flight can lose only one life even if the newly designated owner also disconnects", () => {
  const g = new HeartBounce("r", {}, 9, 0, ctx());
  g.pause(500);
  g.ownerDisconnected(0, 500);
  g.tick(10000);
  expect(g.lives).toBe(2);
  g.ownerDisconnected(1, 11000);
  g.tick(30000);
  expect(g.lives).toBe(2);
});
it("heartbeat accepts the earliest legitimate calibrated Great and ignores duplicate grades", () => {
  const g = new Heartbeat("r", defaults.heartbeat, 1, 0, ctx()),
    n = g.song.notes[0];
  g.act(0, "results", { entries: [[n.id, 2]] }, n.ms - 250);
  g.act(0, "results", { entries: [[n.id, 3]] }, n.ms);
  expect(g.grades[0].get(n.id)).toBe(2);
});
it("an out-of-order partial message cannot change its advertised total or accumulate unlimited assemblies", () => {
  const a = new Assembler();
  expect(
    a.accept({ t: "part", id: "a", index: 1, total: 2, text: "1}" }, 0),
  ).toBeNull();
  expect(
    a.accept({ t: "part", id: "a", index: 0, total: 2, text: '{"x":' }, 1),
  ).toEqual({ x: 1 });
  expect(() =>
    a.accept({ t: "part", id: "a", index: 0, total: 999, text: "" }, 2),
  ).toThrow();
  for (let i = 0; i < 4; i++)
    a.accept({ t: "part", id: String(i), index: 0, total: 2, text: "{" }, 3);
  expect(() =>
    a.accept({ t: "part", id: "5", index: 0, total: 2, text: "{" }, 4),
  ).toThrow();
});
