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
/** Serpentine journey: one row per zone climbing up, finish on top. */
export const LUDO_W = 360;
export const LUDO_H = 476;
export function pathPoint(i: number) {
  if (i >= 35) return { x: 180, y: 34 };
  const row = Math.floor(i / 7),
    col = i % 7,
    x = 44 + (row % 2 ? 6 - col : col) * 45.3;
  return { x, y: 436 - row * 84 };
}
export const zoneScenes = [
  {
    name: "相遇",
    sub: "街角咖啡店",
    sky: ["#ffe9f0", "#ffd3e1"],
    deco: ["☕", "🌸", "🚲"],
  },
  {
    name: "约会",
    sub: "霓虹电影院",
    sky: ["#3c2f6b", "#6a4fa3"],
    deco: ["🎬", "🍿", "🎡"],
  },
  {
    name: "旅行",
    sub: "海边小镇",
    sky: ["#bfe8ff", "#7fcdf2"],
    deco: ["🏖️", "⛵", "🐚"],
  },
  {
    name: "同居",
    sub: "我们的小家",
    sky: ["#f2f7e4", "#d6ecb8"],
    deco: ["🏡", "🐱", "🪴"],
  },
  {
    name: "承诺",
    sub: "星空教堂",
    sky: ["#2b2350", "#4b3b88"],
    deco: ["⛪", "✨", "🌙"],
  },
];
export const cellInfo: Record<string, { name: string; color: string }> = {
  start: { name: "出发", color: "#9be3a3" },
  truth: { name: "真心话", color: "#a9d4ff" },
  challenge: { name: "小挑战", color: "#ffc78a" },
  memory: { name: "回忆", color: "#ffb8cf" },
  fork: { name: "岔路", color: "#cdb8ff" },
  redline: { name: "红线", color: "#ff8f8f" },
  finish: { name: "承诺", color: "#ffe066" },
};
