export const tracks = {
  meet: { name: "初见", bpm: 90, bars: 24, difficulty: "简单" },
  date: { name: "约会", bpm: 110, bars: 32, difficulty: "普通" },
  heart: { name: "心动", bpm: 128, bars: 40, difficulty: "困难" },
} as const;
export type TrackId = keyof typeof tracks;
export interface Note {
  id: number;
  ms: number;
  lane: 0 | 1;
  seats: number[];
  sync: boolean;
}
export function chart(track: TrackId) {
  const info = tracks[track],
    beat = 60000 / info.bpm,
    notes: Note[] = [];
  for (let b = 4; b < info.bars * 4; b++) {
    const sync = b % 4 === 0,
      lane = (Math.floor(b / 2) % 2) as 0 | 1;
    notes.push({
      id: notes.length,
      ms: b * beat,
      lane,
      seats: sync ? [0, 1] : [b % 2],
      sync,
    });
    if (track === "heart" && b % 4 === 3)
      notes.push({
        id: notes.length,
        ms: (b + 0.5) * beat,
        lane: (1 - lane) as 0 | 1,
        seats: [(b + 1) % 2],
        sync: false,
      });
  }
  return { notes, duration: info.bars * 4 * beat + 1000, beat, ...info };
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
