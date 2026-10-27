import { describe, expect, it } from "vitest";
import { Presence } from "../../server/presence";

describe("anonymous online count", () => {
  it("counts each browser once, refreshes activity, and expires inactive browsers", () => {
    const p = new Presence(),
      a = "a".repeat(32),
      b = "b".repeat(32);
    expect(p.heartbeat(a, 1000)).toBe(1);
    expect(p.heartbeat(a, 2000)).toBe(1);
    expect(p.heartbeat(b, 3000)).toBe(2);
    expect(p.heartbeat(b, 62_001)).toBe(1);
    expect(() => p.heartbeat("not-a-client", 62_002)).toThrow("INVALID");
  });
});
