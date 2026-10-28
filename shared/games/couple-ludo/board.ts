export const ludoZones = ["相遇", "约会", "旅行", "同居", "承诺"];
export const zoneColors = [
  "#ffe2eb",
  "#ffedc8",
  "#d8f0ff",
  "#e4f1d5",
  "#e9dfff",
];
export const cellIcons: Record<string, string> = {
  start: "🏡",
  truth: "💬",
  challenge: "🎯",
  memory: "🎁",
  fork: "🌀",
  redline: "⛓️",
  finish: "💍",
};
export const ludoBoard = [
  { kind: "start", zone: 0 },
  { kind: "truth", zone: 0 },
  { kind: "challenge", zone: 0 },
  { kind: "memory", zone: 0 },
  { kind: "truth", zone: 0 },
  { kind: "fork", zone: 0 },
  { kind: "redline", zone: 0 },
  { kind: "truth", zone: 1 },
  { kind: "memory", zone: 1 },
  { kind: "challenge", zone: 1 },
  { kind: "truth", zone: 1 },
  { kind: "redline", zone: 1 },
  { kind: "challenge", zone: 1 },
  { kind: "fork", zone: 1 },
  { kind: "memory", zone: 2 },
  { kind: "truth", zone: 2 },
  { kind: "challenge", zone: 2 },
  { kind: "truth", zone: 2 },
  { kind: "redline", zone: 2 },
  { kind: "memory", zone: 2 },
  { kind: "challenge", zone: 2 },
  { kind: "truth", zone: 3 },
  { kind: "memory", zone: 3 },
  { kind: "challenge", zone: 3 },
  { kind: "fork", zone: 3 },
  { kind: "truth", zone: 3 },
  { kind: "redline", zone: 3 },
  { kind: "challenge", zone: 3 },
  { kind: "memory", zone: 4 },
  { kind: "truth", zone: 4 },
  { kind: "challenge", zone: 4 },
  { kind: "redline", zone: 4 },
  { kind: "truth", zone: 4 },
  { kind: "memory", zone: 4 },
  { kind: "challenge", zone: 4 },
  { kind: "finish", zone: 4 },
];
export function boardPoint(i: number) {
  const angle = -Math.PI / 2 + (i / 36) * Math.PI * 2;
  return { x: 150 + 120 * Math.cos(angle), y: 150 + 120 * Math.sin(angle) };
}
