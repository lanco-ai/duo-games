import { describe, expect, it } from "vitest";
import { HeldControls } from "../../web/src/games/held-controls";

describe("physical game input sources", () => {
  it("keeps a direction until all alias keys are released", () => {
    const c = new HeldControls();
    c.key("ArrowRight", 2, true);
    c.key("KeyD", 2, true);
    c.key("KeyD", 2, false);
    expect(c.bits).toBe(2);
    c.key("ArrowRight", 2, false);
    expect(c.bits).toBe(0);
  });
  it("keeps pointer and keyboard holds independent", () => {
    const c = new HeldControls();
    c.key("Space", 4, true);
    c.pointer(1, 4, true);
    c.pointer(2, 4, true);
    c.key("Space", 4, false);
    c.pointer(1, 4, false);
    expect(c.bits).toBe(4);
    c.pointer(2, 4, false);
    expect(c.bits).toBe(0);
  });
  it("clears every held source on focus change or pause", () => {
    const c = new HeldControls();
    c.key("ShiftLeft", 16, true);
    c.pointer(1, 2, true);
    c.clear();
    expect(c.bits).toBe(0);
    c.key("ShiftLeft", 16, false);
    expect(c.bits).toBe(0);
  });
});
