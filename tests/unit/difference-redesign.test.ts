import { describe, it, expect, vi } from "vitest";
import { SpotDifference } from "../../server/games/difference";
import { differenceLevels } from "../../shared/games/spot-difference/levels";
import type { EngineContext } from "../../shared/games/types";
const ctx = (): EngineContext => ({
  custom: [],
  seen: ["level:spot-difference:5"],
  pair: 0,
  imageRatio: 1,
  emit: vi.fn(),
  gallery: vi.fn(),
  seenQuestion: vi.fn(),
});
const make = (scene = 1) =>
  new SpotDifference("r", { scene, mode: "split" }, 5, 1000, ctx());
describe("P4 asymmetric spot-the-difference scenes", () => {
  it("has five distinct compositions with at least fifteen variable named props", () => {
    expect(differenceLevels).toHaveLength(5);
    for (const l of differenceLevels) {
      expect(l.objects.length).toBeGreaterThanOrEqual(15);
      expect(new Set(l.objects.map((o) => o.id)).size).toBe(l.objects.length);
    }
    expect(
      new Set(
        differenceLevels.map((l) =>
          JSON.stringify(l.objects.map((o) => [o.x, o.y])),
        ),
      ).size,
    ).toBe(5);
  });
  it("sends only the corresponding picture outside tutorial, without selection or opposite image", () => {
    const g = make();
    const a = g.view(0),
      b = g.view(1);
    expect(a.images).toBeUndefined();
    expect(b.images).toBeUndefined();
    expect(a.objects).toEqual(g.scene.objects);
    expect(b.objects).toEqual(g.modified);
    expect(a).not.toHaveProperty("differences");
    expect(a).not.toHaveProperty("selected");
    expect(JSON.stringify(a)).not.toContain("#284ddf");
    expect(g.view(0).objects).not.toEqual(g.view(1).objects);
    expect(make(0).view(0).images).toHaveLength(2);
  });
  it("is reproducible, visibly changes selected props and shares only found markers", () => {
    const g = make(2);
    expect(g.modified).toEqual(make(2).modified);
    for (const id of g.selected) {
      const original = g.scene.objects.find((o) => o.id === id)!;
      const modified = g.modified.find((o) => o.id === id);
      expect(modified).not.toEqual(original);
      if (modified?.size !== original.size && modified)
        expect(modified.size / original.size).toBeGreaterThanOrEqual(1.4);
    }
    const o = g.scene.objects.find((o) => o.id === g.selected[0])!;
    g.act(0, "tap", { x: o.x, y: o.y }, 2000);
    expect(g.view(0).found).toEqual(g.view(1).found);
    expect(g.act(1, "tap", { x: o.x, y: o.y }, 2001)).toBe(false);
  });
  it("penalizes misses, shifts timer/flash and reveals a paired answer keepsake at completion", () => {
    const g = make();
    const before = g.deadline;
    g.act(1, "tap", { x: 0, y: 0 }, 2000);
    expect(g.deadline).toBe(before - 3000);
    g.shift(5000);
    expect(g.deadline).toBe(before + 2000);
    expect(g.view(0, 7000).lastMiss?.at).toBe(7000);
    for (const id of g.selected) {
      const o = g.scene.objects.find((o) => o.id === id)!;
      g.act(0, "tap", { x: o.x, y: o.y }, 8000);
    }
    expect(g.result?.stats.stars).toBe(3);
    expect(g.ctx.gallery).toHaveBeenCalledWith(
      "difference",
      expect.any(String),
      expect.objectContaining({ images: expect.any(Array) }),
    );
  });
});
