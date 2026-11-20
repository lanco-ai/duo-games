import { describe, expect, it } from "vitest";
import {
  DECOR,
  LANDMARKS,
  grantReward,
  normalize,
  rewardFor,
  unlockAt,
  withdrawCards,
  BOAT_MS,
  HOUR,
  MAX_LEVEL,
  apply,
  newIsland,
  plotCount,
  upgradeNeeds,
  type Island,
  type IslandAction,
} from "../../shared/island/rules";
import type { Seat } from "../../shared/protocol";

const T0 = Date.UTC(2026, 10, 20, 0, 0);
let ids = 0;
const act = (s: Island, seat: Seat, a: IslandAction, now: number) =>
  apply(s, seat, a, now, () => "boat-" + ++ids).island;
const bad = (s: Island, seat: Seat, a: any, now = T0) =>
  expect(() => apply(s, seat, a, now)).toThrow("INVALID");

describe("island rules", () => {
  it("grows crops by real time and keeps them ripe forever", () => {
    let s = newIsland(T0);
    expect(s.plots[0]).toHaveLength(3);
    s = act(s, 0, { cmd: "plant", plot: 0, crop: "berry" }, T0);
    bad(s, 0, { cmd: "plant", plot: 0, crop: "wheat" });
    bad(s, 0, { cmd: "harvest", plot: 0 }, T0 + 4 * HOUR - 1);
    s = act(s, 0, { cmd: "harvest", plot: 0 }, T0 + 30 * 24 * HOUR);
    expect(s.bags[0]).toEqual({ berry: 2 });
    expect(s.plots[0][0].crop).toBeNull();
  });

  it("lets each shore grow only its own specialty", () => {
    const s = newIsland(T0);
    bad(s, 0, { cmd: "plant", plot: 0, crop: "coralbud" });
    bad(s, 1, { cmd: "plant", plot: 0, crop: "stoneflower" });
    expect(() =>
      act(s, 0, { cmd: "plant", plot: 0, crop: "stoneflower" }, T0),
    ).not.toThrow();
    bad(s, 0, { cmd: "plant", plot: 9, crop: "berry" });
    bad(s, 0, { cmd: "plant", plot: 0, crop: "rose" });
  });

  it("lets the partner water once, halving the time left", () => {
    let s = act(
      newIsland(T0),
      1,
      { cmd: "plant", plot: 1, crop: "cotton" },
      T0,
    );
    bad(s, 1, { cmd: "water", plot: 1 }); // 浇的是对方的地，自己的地不行
    const r = apply(s, 0, { cmd: "water", plot: 1 }, T0 + 4 * HOUR);
    expect(r.tell).toContain("浇了水");
    s = r.island;
    expect(s.plots[1][1].readyAt).toBe(T0 + 4 * HOUR + 10 * HOUR);
    bad(s, 0, { cmd: "water", plot: 1 }, T0 + 5 * HOUR);
    s = act(s, 1, { cmd: "harvest", plot: 1 }, T0 + 14 * HOUR);
    expect(s.bags[1]).toEqual({ cotton: 2 });
  });

  it("crafts goods and cards from what is in the bag", () => {
    let s = newIsland(T0);
    s.bags[0] = { kelp: 4, wheat: 2 };
    s = act(s, 0, { cmd: "craft", out: "rope" }, T0);
    s = act(s, 0, { cmd: "craft", out: "rope" }, T0);
    s = act(s, 0, { cmd: "craft", out: "paper" }, T0);
    s = act(s, 0, { cmd: "craft", out: "card-boat" }, T0);
    expect(s.bags[0]).toEqual({ rope: 1, "card-boat": 1 });
    bad(s, 0, { cmd: "craft", out: "card-net" });
    bad(s, 0, { cmd: "craft", out: "gold" });
  });

  it("sends a paper boat that lands after an hour and only the partner opens", () => {
    let s = newIsland(T0);
    s.bags[0] = { paper: 1, stone: 3 };
    bad(s, 0, { cmd: "send", items: { stone: 4 }, note: "" });
    bad(s, 0, { cmd: "send", items: {}, note: "" });
    bad(s, 0, { cmd: "send", items: {}, note: "字".repeat(41) });
    const r = apply(
      s,
      0,
      { cmd: "send", items: { stone: 2 }, note: " 给你的石料 " },
      T0,
      () => "b1",
    );
    s = r.island;
    expect(s.bags[0]).toEqual({ stone: 1 });
    expect(s.boats[0]).toMatchObject({ id: "b1", from: 0, note: "给你的石料" });
    bad(s, 1, { cmd: "open", boat: "b1" }, T0 + BOAT_MS - 1);
    bad(s, 0, { cmd: "open", boat: "b1" }, T0 + BOAT_MS);
    s = act(s, 1, { cmd: "open", boat: "b1" }, T0 + BOAT_MS);
    expect(s.bags[1]).toEqual({ stone: 2 });
    expect(s.boats).toEqual([]);
  });

  it("levels up from a shared box that needs both specialties", () => {
    let s = newIsland(T0);
    s.bags[0] = { cloth: 3, stone: 2 };
    s.bags[1] = { coral: 2 };
    s = act(s, 0, { cmd: "contribute", item: "cloth", count: 2 }, T0);
    bad(s, 0, { cmd: "contribute", item: "cloth", count: 1 }); // 已经够了
    s = act(s, 0, { cmd: "contribute", item: "stone", count: 2 }, T0);
    expect(s.level).toBe(1);
    const r = apply(s, 1, { cmd: "contribute", item: "coral", count: 2 }, T0);
    expect(r.leveled).toBe(true);
    s = r.island;
    expect(s.level).toBe(2);
    expect(s.box).toEqual({});
    expect(s.plots[0]).toHaveLength(plotCount(2));
    expect(s.plots[1]).toHaveLength(plotCount(2));
    expect(upgradeNeeds(2)).toEqual({ cloth: 4, stone: 4, coral: 4 });
  });

  it("stops at the top level and never mutates the input", () => {
    const s = newIsland(T0);
    s.level = MAX_LEVEL;
    s.bags[0] = { cloth: 9 };
    const before = structuredClone(s);
    bad(s, 0, { cmd: "contribute", item: "cloth", count: 1 });
    act(s, 0, { cmd: "plant", plot: 0, crop: "berry" }, T0);
    expect(s).toEqual(before);
  });

  it("reaches level 5 in about a week of daily play", () => {
    // 模拟：每天早中晚各上线一次，能收就收、能做就做、东西寄给对方、能放就放
    let s = newIsland(T0);
    let now = T0;
    const visits = [8, 12.5, 22];
    let day = 0;
    for (; day < 14 && s.level < 5; day++)
      for (const h of visits) {
        now = T0 + day * 24 * HOUR + h * HOUR;
        for (const seat of [0, 1] as Seat[]) {
          const other = (1 - seat) as Seat;
          const tryAct = (a: IslandAction) => {
            try {
              s = act(s, seat, a, now);
              return true;
            } catch {
              return false;
            }
          };
          for (const b of [...s.boats]) tryAct({ cmd: "open", boat: b.id });
          s.plots[seat].forEach((_, i) => tryAct({ cmd: "harvest", plot: i }));
          s.plots[other].forEach((_, i) => tryAct({ cmd: "water", plot: i }));
          for (const out of ["cloth", "stone", "coral", "paper"] as const)
            while (tryAct({ cmd: "craft", out }));
          for (const item of ["cloth", "stone", "coral"] as const)
            while (tryAct({ cmd: "contribute", item, count: 1 }));
          // 自己用不上的特产材料寄给对方（这里简化：一方需要的放不进箱子时才寄）
          const special = seat === 0 ? "stone" : "coral";
          if ((s.bags[seat][special] ?? 0) > 0 && (s.bags[seat].paper ?? 0) > 0)
            tryAct({
              cmd: "send",
              items: { [special]: s.bags[seat][special]! },
              note: "",
            });
          const crops =
            seat === 0
              ? (["stoneflower", "cotton", "wheat"] as const)
              : (["coralbud", "cotton", "wheat"] as const);
          s.plots[seat].forEach((_, i) =>
            tryAct({ cmd: "plant", plot: i, crop: crops[i % crops.length] }),
          );
        }
      }
    expect(s.level).toBe(5);
    expect(day).toBeGreaterThanOrEqual(6);
    expect(day).toBeLessThanOrEqual(9);
  });

  it("caps plots at 8 per side and unlocks a landmark at levels 7–10", () => {
    expect([1, 5, 6, 7, 10].map(plotCount)).toEqual([3, 7, 8, 8, 8]);
    expect(MAX_LEVEL).toBe(10);
    expect(unlockAt(6)).toBe("两边各多一块地");
    expect(unlockAt(7)).toBe("地标 · " + LANDMARKS[7].name);
    expect(Object.keys(LANDMARKS)).toEqual(["7", "8", "9", "10"]);
  });

  it("hands island-made cards to the tide deck and removes them from the bag", () => {
    const s = newIsland(T0);
    s.bags[0] = { "card-lamp": 9, "card-net": 5, berry: 2 };
    const r = withdrawCards(s, 0);
    expect(r.cards).toHaveLength(12);
    expect(r.cards.filter((c) => c === "lamp")).toHaveLength(9);
    expect(r.cards.filter((c) => c === "net")).toHaveLength(3);
    expect(r.island.bags[0]).toEqual({ "card-net": 2, berry: 2 });
    expect(s.bags[0]["card-lamp"]).toBe(9); // 不改原对象
    expect(withdrawCards(s, 1).cards).toEqual([]);
  });

  it("rewards the winner with rotating decor and the other with a 3-crop seed pack", () => {
    let s = newIsland(T0);
    let random = 0.1;
    const rnd = () => (random = (random * 7.3) % 1);
    for (let i = 0; i < 4; i++)
      s = grantReward(s, 0, rewardFor(s, 0, true, rnd));
    expect(s.decor![0]).toEqual([
      DECOR[0].id,
      DECOR[1].id,
      DECOR[2].id,
      DECOR[0].id,
    ]);
    const pack = rewardFor(s, 1, false, rnd);
    expect(pack.kind).toBe("seeds");
    s = grantReward(s, 1, pack);
    expect(Object.values(s.bags[1]).reduce((a, b) => a! + b!, 0)).toBe(3);
  });

  it("upgrades islands saved before decorations existed", () => {
    const old = newIsland(T0) as any;
    delete old.decor;
    expect(normalize(old).decor).toEqual([[], []]);
  });

  it("reaches level 10 in roughly three weeks of daily play", () => {
    let s = newIsland(T0),
      day = 0;
    for (; day < 40 && s.level < MAX_LEVEL; day++)
      for (const h of [8, 12.5, 22]) {
        const now = T0 + day * 24 * HOUR + h * HOUR;
        for (const seat of [0, 1] as Seat[]) {
          const tryAct = (a: IslandAction) => {
            try {
              s = act(s, seat, a, now);
              return true;
            } catch {
              return false;
            }
          };
          for (const b of [...s.boats]) tryAct({ cmd: "open", boat: b.id });
          s.plots[seat].forEach((_, i) => tryAct({ cmd: "harvest", plot: i }));
          s.plots[1 - seat].forEach((_, i) =>
            tryAct({ cmd: "water", plot: i }),
          );
          for (const out of ["cloth", "stone", "coral", "paper"] as const)
            while (tryAct({ cmd: "craft", out }));
          for (const item of ["cloth", "stone", "coral"] as const)
            while (tryAct({ cmd: "contribute", item, count: 1 }));
          const special = seat === 0 ? "stone" : "coral";
          if ((s.bags[seat][special] ?? 0) > 0 && (s.bags[seat].paper ?? 0) > 0)
            tryAct({
              cmd: "send",
              items: { [special]: s.bags[seat][special]! },
              note: "",
            });
          const crops =
            seat === 0
              ? (["stoneflower", "cotton", "wheat"] as const)
              : (["coralbud", "cotton", "wheat"] as const);
          s.plots[seat].forEach((_, i) =>
            tryAct({ cmd: "plant", plot: i, crop: crops[i % crops.length] }),
          );
        }
      }
    expect(s.level).toBe(MAX_LEVEL);
    expect(day).toBeGreaterThanOrEqual(14);
    expect(day).toBeLessThanOrEqual(28);
  });
});
