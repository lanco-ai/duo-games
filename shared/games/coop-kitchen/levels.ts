export type FoodKind = "tomato" | "lettuce" | "meat" | "bread";
export const foodIcons = {
  tomato: "🍅",
  lettuce: "🥬",
  meat: "🥩",
  bread: "🍞",
};
export const recipes = {
  salad: {
    name: "沙拉",
    foods: ["lettuce:chopped", "tomato:chopped"],
    score: 100,
  },
  sandwich: {
    name: "三明治",
    foods: ["bread:raw", "tomato:chopped"],
    score: 100,
  },
  burger: {
    name: "汉堡",
    foods: ["bread:raw", "lettuce:chopped", "meat:cooked"],
    score: 150,
  },
  hotpot: {
    name: "火锅",
    foods: ["meat:boiled", "tomato:chopped"],
    score: 180,
  },
} as const;
export type Recipe = keyof typeof recipes;
export const kitchenLevels = [
  {
    name: "第一次约会便当",
    seconds: 120,
    stars: [200, 400, 600],
    recipes: ["salad", "sandwich"],
    bar: false,
    pot: false,
    swap: false,
    cake: false,
  },
  {
    name: "中间的吧台",
    seconds: 150,
    stars: [300, 600, 900],
    recipes: ["burger", "salad"],
    bar: true,
    pot: false,
    swap: false,
    cake: false,
  },
  {
    name: "火锅夜",
    seconds: 180,
    stars: [400, 800, 1100],
    recipes: ["hotpot", "burger"],
    bar: false,
    pot: true,
    swap: false,
    cake: false,
  },
  {
    name: "移动餐车",
    seconds: 180,
    stars: [500, 900, 1300],
    recipes: ["salad", "sandwich", "burger", "hotpot"],
    bar: false,
    pot: true,
    swap: true,
    cake: false,
  },
  {
    name: "纪念日蛋糕",
    seconds: 200,
    stars: [600, 1000, 1500],
    recipes: ["salad", "sandwich", "burger", "hotpot"],
    bar: false,
    pot: true,
    swap: false,
    cake: true,
  },
] as const;
export const cakeSteps = [
  "混合面糊",
  "倒入模具",
  "烘烤蛋糕",
  "打发奶油",
  "裱花装饰",
  "一起点亮蜡烛",
];
export interface Station {
  id: string;
  x: number;
  y: number;
  label: string;
}
export function kitchenStations(level: number, swapped = false): Station[] {
  const bar = kitchenLevels[level].bar;
  const list: Station[] = [
    { id: "tomato", x: 0, y: 0, label: "🍅" },
    { id: "lettuce", x: 2, y: 0, label: "🥬" },
    { id: "meat", x: 0, y: 7, label: "🥩" },
    { id: "bread", x: 7, y: 0, label: "🍞" },
    { id: "board0", x: 0, y: 2, label: "🔪" },
    { id: "board1", x: 7, y: 2, label: "🔪" },
    { id: "pan0", x: 7, y: 4, label: "🍳" },
    { id: "pan1", x: 7, y: 6, label: "🍳" },
    { id: "plate0", x: 2, y: 7, label: "🍽️" },
    { id: "plate1", x: 6, y: 7, label: "🍽️" },
    { id: "serve", x: 6, y: 0, label: "🔔" },
    { id: "trash", x: 0, y: 5, label: "🗑️" },
  ];
  if (bar)
    list.push(
      { id: "handoff0", x: 4, y: 2, label: "🤝" },
      { id: "handoff1", x: 4, y: 5, label: "🤝" },
    );
  if (level >= 2)
    list.push(
      { id: "sink", x: 3, y: 7, label: "🚰" },
      { id: "pot", x: 5, y: 7, label: "🫕" },
    );
  if (level === 4)
    list.push(
      { id: "cake0", x: 2, y: 3, label: "🎂" },
      { id: "cake1", x: 6, y: 3, label: "🎂" },
    );
  return list.map((s) =>
    swapped && ["tomato", "lettuce", "meat", "bread"].includes(s.id)
      ? { ...s, x: 7 - s.x }
      : s,
  );
}
export function walkable(
  x: number,
  y: number,
  stations: Station[],
  bar: boolean,
) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x <= 7 &&
    y <= 7 &&
    !(bar && Math.abs(x - 4) < 0.5) &&
    !stations.some((s) => Math.abs(x - s.x) < 0.48 && Math.abs(y - s.y) < 0.48)
  );
}
