import { describe, it, expect, vi } from "vitest";
import { HideSeek } from "../../server/games/hide-seek";
import { hideMaps } from "../../shared/games/hide-seek/maps";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: ["level:hide-seek:3"],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
});
const make = () => new HideSeek("r", { map: "1" }, 9, 1000, ctx());
const hide = (g: HideSeek, now = 2000) =>
  g.act(g.hider, "hide", { round: g.round, id: 8, decoys: [0, 3] }, now);
describe("P6 spatial secret hide-and-seek", () => {
  it("defines three maps with four rooms and twenty-two named connected hiding places", () => {
    expect(hideMaps).toHaveLength(3);
    for (const m of hideMaps) {
      expect(m.rooms).toHaveLength(4);
      expect(m.spots).toHaveLength(22);
      for (const s of m.spots)
        for (const n of s.neighbors) expect(m.spots[n].room).toBe(s.room);
    }
  });
  it("sends no hiding or true decoy fields to the seeker; suspicious markers mix real and harmless locations", () => {
    const g = make();
    hide(g);
    const seeker = g.view(g.seeker),
      hider = g.view(g.hider);
    expect(seeker).not.toHaveProperty("ownHide");
    expect(seeker).not.toHaveProperty("ownDecoys");
    expect(seeker).not.toHaveProperty("hiding");
    expect(hider.ownHide).toBe(8);
    expect(hider.ownDecoys).toEqual([0, 3]);
    expect(seeker.suspicious).toHaveLength(5);
    expect(seeker.suspicious).toEqual(hider.suspicious);
  });
  it("lets the hider relocate only twice to adjacent points in the same room and exposes only the room sound", () => {
    const g = make();
    hide(g);
    expect(() => g.act(g.hider, "move", { round: 0, id: 14 }, 2500)).toThrow();
    g.act(g.hider, "move", { round: 0, id: 7 }, 2600);
    expect(g.view(g.seeker, 2601).sound?.room).toBe(1);
    g.act(g.hider, "move", { round: 0, id: 8 }, 2700);
    expect(() => g.act(g.hider, "move", { round: 0, id: 7 }, 2800)).toThrow();
  });
  it("makes one search quiet when playing dead, and traps spend five seconds", () => {
    const g = make();
    hide(g);
    const deadline = g.deadline;
    g.act(g.seeker, "search", { round: 0, id: 0 }, 2500);
    expect(g.deadline).toBe(deadline - 5000);
    g.act(g.hider, "dead", { round: 0 }, 2600);
    g.act(g.seeker, "search", { round: 0, id: 8 }, 2700);
    expect(g.hint).toBe("很安静");
    expect(g.phase).toBe("seek");
    g.act(g.seeker, "search", { round: 0, id: 8 }, 2800);
    expect(g.phase).toBe("round-end");
  });
  it("gives truthful room-distance clues and shifts deadlines and movement sounds on pause", () => {
    const g = make();
    hide(g);
    g.act(g.seeker, "search", { round: 0, id: 7 }, 2300);
    expect(g.hint).toContain("呼吸");
    g.act(g.seeker, "search", { round: 0, id: 1 }, 2400);
    expect(g.hint).toContain("隔壁");
    g.act(g.hider, "move", { round: 0, id: 7 }, 2500);
    const deadline = g.deadline;
    g.shift(10000);
    expect(g.deadline).toBe(deadline + 10000);
    expect(g.view(g.seeker, 12501).sound?.at).toBe(12500);
  });
  it("exchanges roles across three scored rounds, reaches a result and records all hiding memories", () => {
    const g = make();
    for (let round = 0; round < 3; round++) {
      const now = 2000 + round * 10000;
      hide(g, now);
      g.act(g.seeker, "search", { round, id: 8 }, now + 500);
      g.act(0, "next", { round }, now + 1000);
    }
    expect(g.result?.stats.winner).toBe(0);
    expect(g.result?.stats.stars).toBe(2);
    expect(g.history).toHaveLength(3);
    expect(g.ctx.gallery).toHaveBeenCalled();
    expect(g.ctx.seenQuestion).toHaveBeenCalledWith("level:hide-seek:2");
  });
});
describe("hide-and-seek scene tools", () => {
  it("lets the hider fake one creak and the seeker use the map tool once", () => {
    const g = make();
    hide(g);
    g.act(g.hider, "fake", { round: 0, room: 3 }, 2100);
    expect(g.view(g.seeker, 2200).sound?.room).toBe(3);
    expect(() => g.act(g.hider, "fake", { round: 0, room: 2 }, 2300)).toThrow();
    expect(g.view(g.seeker)).not.toHaveProperty("canFake");
    g.act(g.seeker, "tool", { round: 0, room: 0 }, 2400);
    expect(g.tool?.spots.sort()).toEqual([0, 3]);
    expect(() =>
      g.act(g.seeker, "tool", { round: 0, room: 1 }, 2500),
    ).toThrow();
    g.act(g.seeker, "search", { round: 0, id: 7 }, 2600);
    expect(g.view(g.seeker).trail).toEqual([{ id: 7, hint: g.hint }]);
    g.act(g.seeker, "search", { round: 0, id: 8 }, 2700);
    expect(g.lastRound?.id).toBe(8);
    g.act(0, "next", { round: 0 }, 3000);
    expect(g.tool).toBeNull();
    expect(g.trail).toEqual([]);
  });
  it("firefly and crystal ball tools never lie about the hider", () => {
    const cabin = new HideSeek("r", { map: "2" }, 9, 1000, ctx());
    hide(cabin);
    cabin.act(cabin.seeker, "tool", { round: 0, room: 1 }, 2100);
    expect(cabin.tool?.text).toContain("打转");
    const haunted = new HideSeek("r", { map: "3" }, 9, 1000, ctx());
    hide(haunted);
    haunted.act(haunted.seeker, "tool", { round: 0, room: 1 }, 2100);
    expect(haunted.tool?.spots).toHaveLength(2);
    expect(haunted.tool?.spots).not.toContain(8);
  });
});
