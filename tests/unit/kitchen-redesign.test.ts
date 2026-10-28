import { describe, it, expect, vi } from "vitest";
import { CoopKitchen } from "../../server/games/kitchen";
import {
  kitchenLevels,
  kitchenStations,
  recipes,
} from "../../shared/games/coop-kitchen/levels";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: ["level:coop-kitchen:6"],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  seenQuestion: vi.fn(),
  gallery: vi.fn(),
});
const make = (level = "1") => new CoopKitchen("r", { level }, 23, 1000, ctx());
describe("P2 cooperative kitchen levels", () => {
  it("defines five independent levels, two plating tables and data-driven recipes", () => {
    expect(kitchenLevels).toHaveLength(5);
    for (let i = 0; i < 5; i++)
      expect(
        kitchenStations(i).filter((s) => s.id.startsWith("plate")),
      ).toHaveLength(2);
    expect(Object.keys(recipes)).toHaveLength(4);
  });
  it("cuts on server time and only lets one player reserve a board", () => {
    const g = make();
    g.players[0] = {
      x: 1,
      y: 2,
      held: { kind: "tomato", stage: "raw", cuts: 0 },
    };
    g.players[1] = { x: 0, y: 3, held: null };
    g.act(0, "interact", { station: "board0" }, 1000);
    g.act(0, "interact", { station: "board0" }, 1001);
    expect(() => g.act(1, "interact", { station: "board0" }, 1002)).toThrow(
      "LOCKED",
    );
    g.shift(5000);
    g.tick(8000);
    expect(g.boards[0]?.stage).toBe("raw");
    g.tick(8001);
    expect(g.boards[0]?.stage).toBe("chopped");
    expect(g.contributions[0].cuts).toBe(1);
  });
  it("rejects wall crossing, teleporting and repeated movement bursts", () => {
    const g = make("2");
    g.players[0].x = 3;
    expect(g.move(0, 5, 3, 2000)).toBe(false);
    expect(g.move(0, 7, 3, 2100)).toBe(false);
    g.players[0].x = 1;
    expect(g.move(0, 2, 3, 3000)).toBe(true);
    expect(g.move(0, 3, 3, 3000)).toBe(true);
    expect(g.move(0, 3.5, 3, 3000)).toBe(false);
  });
  it("hands ingredients over a blocking counter and counts the recipient contribution", () => {
    const g = make("2");
    g.players[0] = {
      x: 3,
      y: 2,
      held: { kind: "tomato", stage: "chopped", cuts: 3 },
    };
    g.players[1] = { x: 5, y: 2, held: null };
    g.act(0, "interact", { station: "handoff0" }, 2000);
    g.act(1, "interact", { station: "handoff0" }, 2100);
    expect(g.players[1].held?.kind).toBe("tomato");
    expect(g.contributions[1].passed).toBe(1);
  });
  it("serves a real recipe, supplies new orders, and retains dirty plates on later levels", () => {
    const g = make("3");
    g.orders = [{ id: 0, kind: "burger", deadline: 60000 }];
    g.players[0] = {
      x: 6,
      y: 1,
      held: {
        kind: "plate",
        dirty: false,
        foods: [
          { kind: "bread", stage: "raw", cuts: 0 },
          { kind: "lettuce", stage: "chopped", cuts: 3 },
          { kind: "meat", stage: "cooked", cuts: 3 },
        ],
      },
    };
    g.act(0, "interact", { station: "serve" }, 2000);
    expect(g.served).toBe(1);
    expect(g.players[0].held?.kind).toBe("plate");
    expect(g.score).toBe(150);
    g.players[0].x = 3;
    g.players[0].y = 6;
    g.act(0, "interact", { station: "sink" }, 3000);
    g.tick(5000);
    expect((g.players[0].held as any).dirty).toBe(false);
  });
  it("moves pan, pot, order and swap clocks on reconnect and bounds endless order pressure", () => {
    const g = make("3");
    g.pot = { item: { kind: "meat", stage: "chopped", cuts: 3 }, at: 1000 };
    g.shift(10000);
    g.tick(24000);
    expect(g.pot.item.stage).toBe("chopped");
    g.tick(26000);
    expect(g.pot.item.stage).toBe("burned");
    const endless = make("endless");
    for (let i = 0; i < 200; i++) endless.addOrder(2000);
    expect(endless.orders.length).toBeLessThanOrEqual(4);
    expect(endless.tick(999999)).toBe(true);
    expect(endless.result).toBeNull();
  });
  it("requires both cake stations for six held steps and settles stars and keepsakes", () => {
    const g = make("5");
    g.players[0].x = 2;
    g.players[0].y = 4;
    g.players[1].x = 6;
    g.players[1].y = 4;
    for (let step = 0; step < 6; step++) {
      const now = 2000 + step * 3000;
      g.act(0, "interact", { station: "cake0" }, now);
      g.tick(now + 2000);
      expect(g.cakeStep).toBe(step);
      g.act(1, "interact", { station: "cake1" }, now + 2000);
      g.tick(now + 4000);
    }
    expect(g.cakeDone).toBe(true);
    expect(g.score).toBe(600);
    g.tick(g.endsAt);
    expect(g.result?.stats.stars).toBe(0);
    expect(g.ctx.gallery).toHaveBeenCalled();
    expect(g.view(0)).toEqual(g.view(1));
  });
});
it("shows cake work only where cake stations exist and cancels physical jobs on disconnect", () => {
  const g = make();
  expect(g.view(0).cakeLabel).toBeNull();
  const cake = make("5");
  expect(cake.view(0).cakeLabel).toBeTruthy();
  g.jobs[0] = { station: "board0", at: 1000 };
  g.move(0, 1, 3, 1001);
  expect(g.jobs[0]).not.toBeNull();
  g.pause();
  expect(g.jobs).toEqual([null, null]);
});
