export const jumpLevels = [
  {
    name: "草地",
    jumps: 10,
    width: 110,
    min: 120,
    range: 90,
    moving: 0,
    ice: false,
    heart: false,
    sky: "#d9f5db",
  },
  {
    name: "雪山",
    jumps: 10,
    width: 90,
    min: 160,
    range: 110,
    moving: 0,
    ice: true,
    heart: false,
    sky: "#e0f3ff",
  },
  {
    name: "云端",
    jumps: 12,
    width: 76,
    min: 170,
    range: 110,
    moving: 30,
    ice: false,
    heart: false,
    sky: "#eadfff",
  },
  {
    name: "星河",
    jumps: 14,
    width: 62,
    min: 180,
    range: 120,
    moving: 40,
    ice: false,
    heart: true,
    sky: "#18274c",
  },
] as const;
export const JUMP_SCALE = 0.25;
export interface JumpPlatform {
  x: number;
  y: number;
  width: number;
  amplitude: number;
  phase: number;
  heart: boolean;
}
export function platformX(p: JumpPlatform, elapsed: number) {
  return p.x + Math.sin(elapsed / 1300 + p.phase) * p.amplitude;
}
export function jumpLanding(held: number, p: JumpPlatform, elapsed: number) {
  const distance = held * JUMP_SCALE,
    error = Math.abs(distance - platformX(p, elapsed));
  return {
    distance,
    landed: error <= p.width / 2,
    center: error <= p.width * 0.08,
  };
}
