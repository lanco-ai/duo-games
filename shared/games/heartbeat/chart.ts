import { mulberry32 } from "../../rng";
export const tracks = {
  meet: { name: "初见", bpm: 90, bars: 24, difficulty: "简单" },
  date: { name: "约会", bpm: 110, bars: 32, difficulty: "普通" },
  heart: { name: "心动", bpm: 128, bars: 40, difficulty: "困难" },
} as const;
export type TrackId = keyof typeof tracks;
export type RhythmDifficulty = "easy" | "normal" | "hard";
export interface Note {
  id: number;
  ms: number;
  lane: 0 | 1;
  seats: number[];
  sync: boolean;
  kind: "tap" | "hold" | "relay-head" | "relay-tail";
  duration?: number;
  relay?: string;
  burst?: boolean;
}
// Hand-authored one-bar patterns: offsets in beats, lane, optional sustain/relay.
type PatternNote = [number, 0 | 1, ("hold" | "relay")?];
export const patterns: PatternNote[][] = [
  [
    [0, 0],
    [1, 1],
    [2, 0],
    [3, 1],
  ],
  [
    [0, 0],
    [0.5, 1],
    [1, 0],
    [1.5, 1],
    [2, 0],
    [2.5, 1],
    [3, 0],
    [3.5, 1],
  ],
  [
    [0.5, 0],
    [1.5, 1],
    [2.5, 0],
    [3.5, 1],
  ],
  [
    [0, 0],
    [2, 1],
  ],
  [
    [0, 0],
    [0.75, 1],
    [1.5, 0],
    [2.75, 1],
    [3.5, 0],
  ],
  [
    [0, 0, "hold"],
    [2, 1, "hold"],
  ],
  [
    [0, 0, "relay"],
    [2, 1],
  ],
  [
    [0, 0, "hold"],
    [1.5, 1],
    [2.5, 0],
    [3.5, 1],
  ],
  [
    [0, 0],
    [0.5, 1],
    [1.5, 0],
    [2, 1],
    [3, 0],
    [3.5, 1],
  ],
  [
    [0, 1],
    [1, 0],
    [2.5, 1],
    [3.5, 0],
  ],
  [
    [0, 0],
    [2 / 3, 1],
    [4 / 3, 0],
    [2, 1],
    [8 / 3, 0],
    [10 / 3, 1],
  ],
  [
    [0, 0, "hold"],
    [3.5, 1],
  ],
  [
    [0, 0, "relay"],
    [2, 1, "relay"],
  ],
  [
    [0, 1],
    [0.75, 0],
    [1.5, 1],
    [2.5, 0],
    [3.25, 1],
  ],
  [
    [0, 0],
    [1.5, 1, "hold"],
  ],
  [
    [0, 1],
    [0.5, 0],
    [1.5, 1],
    [2.5, 0],
    [3.5, 1],
  ],
];
export function chart(
  track: TrackId,
  difficulty: RhythmDifficulty = track === "meet"
    ? "easy"
    : track === "date"
      ? "normal"
      : "hard",
) {
  const info = tracks[track],
    beat = 60000 / info.bpm,
    notes: Note[] = [],
    rand = mulberry32(
      { meet: 71, date: 182, heart: 599 }[track] +
        { easy: 0, normal: 1000, hard: 2000 }[difficulty],
    );
  let owner = 0;
  const chorusStart = Math.floor(info.bars * 0.45),
    chorusEnd = Math.floor(info.bars * 0.85) - 1;
  for (let bar = 1; bar < info.bars; bar++) {
    const chorus = bar >= chorusStart && bar <= chorusEnd,
      section =
        bar < 4
          ? "intro"
          : chorus
            ? "chorus"
            : bar > chorusEnd
              ? "outro"
              : "verse";
    const pool =
      difficulty === "easy"
        ? [0, 2, 3, 5, 11]
        : difficulty === "normal"
          ? [0, 1, 2, 4, 5, 6, 7, 8, 11, 12, 13]
          : patterns.map((_, i) => i);
    const chosen =
      bar === 1
        ? 0
        : bar === 3
          ? 5
          : bar === 5
            ? 6
            : pool[Math.floor(rand() * pool.length)];
    const pattern = bar === chorusEnd ? patterns[1] : patterns[chosen];
    for (const [offset, lane, kind] of pattern) {
      const ms = (bar * 4 + offset) * beat;
      if (kind === "relay" && section !== "intro") {
        const relay = bar + "-" + offset;
        notes.push({
          id: notes.length,
          ms,
          lane,
          seats: [bar % 2],
          sync: false,
          kind: "relay-head",
          relay,
        });
        notes.push({
          id: notes.length,
          ms: ms + beat / 2,
          lane: (1 - lane) as 0 | 1,
          seats: [1 - (bar % 2)],
          sync: false,
          kind: "relay-tail",
          relay,
        });
        continue;
      }
      const burst = bar === chorusEnd,
        sync = burst || (chorus && !kind && (offset === 0 || offset === 2));
      const seats = sync ? [0, 1] : [owner++ % 2];
      notes.push({
        id: notes.length,
        ms,
        lane,
        seats,
        sync,
        kind: kind === "hold" ? "hold" : "tap",
        ...(kind === "hold"
          ? { duration: Math.min(1.25, 4 - offset) * beat }
          : {}),
        ...(burst ? { burst: true } : {}),
      });
    }
  }
  return {
    notes,
    duration: info.bars * 4 * beat + 1000,
    beat,
    ...info,
    difficulty,
  };
}
export function grade(delta: number) {
  const d = Math.abs(delta);
  return d <= 45 ? 3 : d <= 90 ? 2 : d <= 135 ? 1 : 0;
}
export function accuracy(grades: number[], total: number) {
  return total
    ? Math.round((grades.reduce((a, b) => a + b, 0) / (total * 3)) * 100)
    : 0;
}
