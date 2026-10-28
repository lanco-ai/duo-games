import { describe, it, expect, vi } from "vitest";
import {
  chart,
  patterns,
  type TrackId,
  type RhythmDifficulty,
} from "../../shared/games/heartbeat/chart";
import { Heartbeat } from "../../server/games/heartbeat";
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
describe("P7 authored rhythm phrases, sustains and relays", () => {
  it("combines sixteen phrases reproducibly at three difficulties with balanced seats and >=120ms gaps", () => {
    expect(patterns).toHaveLength(16);
    for (const track of ["meet", "date", "heart"] as TrackId[])
      for (const difficulty of [
        "easy",
        "normal",
        "hard",
      ] as RhythmDifficulty[]) {
        const a = chart(track, difficulty);
        expect(a).toEqual(chart(track, difficulty));
        expect(a.notes.some((n) => n.kind === "hold")).toBe(true);
        expect(a.notes.some((n) => n.kind === "relay-tail")).toBe(true);
        for (let i = 1; i < a.notes.length; i++)
          expect(a.notes[i].ms - a.notes[i - 1].ms).toBeGreaterThanOrEqual(120);
        const counts = [0, 1].map(
          (s) => a.notes.filter((n) => n.seats.includes(s)).length,
        );
        expect(
          Math.abs(counts[0] - counts[1]) / Math.max(...counts),
        ).toBeLessThanOrEqual(0.1);
        expect(a.notes.filter((n) => n.burst)).toHaveLength(8);
      }
  });
  it("rejects positive sustain grades before the tail, credits relays and reports chorus bursts separately", () => {
    const g = new Heartbeat(
      "r",
      { track: "meet", difficulty: "normal" },
      1,
      1000,
      ctx(),
    );
    const hold = g.song.notes.find((n) => n.kind === "hold")!;
    expect(() =>
      g.act(
        hold.seats[0] as 0 | 1,
        "results",
        { entries: [[hold.id, 3]] },
        1000 + hold.ms,
      ),
    ).toThrow();
    g.act(
      hold.seats[0] as 0 | 1,
      "results",
      { entries: [[hold.id, 3]] },
      1000 + hold.ms + hold.duration!,
    );
    const relay = g.song.notes.find((n) => n.relay)!.relay;
    for (const n of g.song.notes.filter((n) => n.relay === relay))
      g.act(
        n.seats[0] as 0 | 1,
        "results",
        { entries: [[n.id, 3]] },
        1000 + n.ms,
      );
    expect(g.relays.has(relay!)).toBe(true);
    g.tick(1000 + g.song.duration + 5000);
    expect(g.result?.stats).toHaveProperty("burstSync");
    expect(g.view(0)).not.toHaveProperty("otherGrades");
  });
  it("moves the audio epoch on pause so the same note remains at the same relative time", () => {
    const g = new Heartbeat(
      "r",
      { track: "meet", difficulty: "easy" },
      1,
      1000,
      ctx(),
    );
    g.shift(9000);
    expect(g.view(0).startAt).toBe(10000);
    expect(g.tick(1000 + g.song.duration + 5000)).toBe(false);
  });
});
