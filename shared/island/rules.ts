// 半途岛规则：纯函数，前后端共用。所有时间都由调用方传入 now，不跑定时器。
//
// 座位 0 管东岸（特产石花），座位 1 管西岸（特产珊瑚芽）。
// 作物按真实时间生长，成熟后一直停在成熟。对方可以给你的作物浇一次水，剩余时间减半。
// 纸船 1 小时后靠岸，对方打开后东西才进背包。
import type { Seat } from "../protocol";

export const HOUR = 3_600_000;
export const MAX_LEVEL = 5;
export const BOAT_MS = HOUR;
export const NOTE_MAX = 40;

export type Crop =
  | "berry"
  | "wheat"
  | "kelp"
  | "cotton"
  | "stoneflower"
  | "coralbud";
export type Good = "oil" | "paper" | "rope" | "cloth" | "stone" | "coral";
export type CardItem =
  | "card-lamp"
  | "card-boat"
  | "card-net"
  | "card-stone"
  | "card-coral";
export type Item = Crop | Good | CardItem;

export const CROPS: Record<
  Crop,
  { name: string; hours: number; only?: Seat; yield: number }
> = {
  berry: { name: "海莓", hours: 4, yield: 2 },
  wheat: { name: "月麦", hours: 8, yield: 2 },
  kelp: { name: "潮藻", hours: 8, yield: 2 },
  cotton: { name: "暖棉", hours: 24, yield: 2 },
  stoneflower: { name: "石花", hours: 24, only: 0, yield: 2 },
  coralbud: { name: "珊瑚芽", hours: 24, only: 1, yield: 2 },
};
export const ITEM_NAMES: Record<Item, string> = {
  ...(Object.fromEntries(
    Object.entries(CROPS).map(([k, v]) => [k, v.name]),
  ) as Record<Crop, string>),
  oil: "灯油",
  paper: "纸",
  rope: "绳",
  cloth: "布",
  stone: "石料",
  coral: "珊瑚",
  "card-lamp": "灯牌",
  "card-boat": "船牌",
  "card-net": "网牌",
  "card-stone": "石牌",
  "card-coral": "珊瑚牌",
};
export const ITEMS = Object.keys(ITEM_NAMES) as Item[];
export const SHORE_NAMES = ["东岸", "西岸"] as const;

export type Recipe = { out: Item; needs: Partial<Record<Item, number>> };
export const RECIPES: Recipe[] = [
  { out: "oil", needs: { berry: 2 } },
  { out: "paper", needs: { wheat: 2 } },
  { out: "rope", needs: { kelp: 2 } },
  { out: "cloth", needs: { cotton: 2 } },
  { out: "stone", needs: { stoneflower: 1 } },
  { out: "coral", needs: { coralbud: 1 } },
  { out: "card-lamp", needs: { oil: 1 } },
  { out: "card-boat", needs: { paper: 1, rope: 1 } },
  { out: "card-net", needs: { rope: 2 } },
  { out: "card-stone", needs: { stone: 1 } },
  { out: "card-coral", needs: { coral: 1 } },
];
/** 纸船要用掉一张纸 */
export const BOAT_COST: Partial<Record<Item, number>> = { paper: 1 };
/** 从 level 升到 level+1 要放进建设箱的材料：布、石料、珊瑚各 2×level 份 */
export function upgradeNeeds(level: number): Partial<Record<Item, number>> {
  return { cloth: level * 2, stone: level * 2, coral: level * 2 };
}
export const plotCount = (level: number) => 2 + level;

export interface Plot {
  crop: Crop | null;
  plantedAt: number;
  readyAt: number;
  wateredAt: number | null;
}
export interface Boat {
  id: string;
  from: Seat;
  items: Partial<Record<Item, number>>;
  note: string;
  sentAt: number;
  arrivesAt: number;
}
export interface Island {
  level: number;
  plots: [Plot[], Plot[]];
  bags: [Partial<Record<Item, number>>, Partial<Record<Item, number>>];
  /** 建设箱：两人一起往里放，凑够就升级 */
  box: Partial<Record<Item, number>>;
  boats: Boat[];
  createdAt: number;
}

const emptyPlot = (): Plot => ({
  crop: null,
  plantedAt: 0,
  readyAt: 0,
  wateredAt: null,
});
export function newIsland(now: number): Island {
  return {
    level: 1,
    plots: [
      Array.from({ length: plotCount(1) }, emptyPlot),
      Array.from({ length: plotCount(1) }, emptyPlot),
    ],
    bags: [{}, {}],
    box: {},
    boats: [],
    createdAt: now,
  };
}

function fail(): never {
  throw new Error("INVALID");
}
const count = (n: unknown, max: number) =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= max;
function has(
  bag: Partial<Record<Item, number>>,
  needs: Partial<Record<Item, number>>,
) {
  return Object.entries(needs).every(
    ([k, n]) => (bag[k as Item] ?? 0) >= (n as number),
  );
}
function take(
  bag: Partial<Record<Item, number>>,
  needs: Partial<Record<Item, number>>,
) {
  if (!has(bag, needs)) fail();
  for (const [k, n] of Object.entries(needs)) {
    const left = (bag[k as Item] ?? 0) - (n as number);
    if (left > 0) bag[k as Item] = left;
    else delete bag[k as Item];
  }
}
function give(
  bag: Partial<Record<Item, number>>,
  items: Partial<Record<Item, number>>,
) {
  for (const [k, n] of Object.entries(items))
    bag[k as Item] = (bag[k as Item] ?? 0) + (n as number);
}
function clone(s: Island): Island {
  return structuredClone(s);
}
function plotOf(s: Island, side: Seat, index: unknown) {
  if (!Number.isInteger(index)) fail();
  return s.plots[side][index as number] ?? fail();
}

export type IslandAction =
  | { cmd: "plant"; plot: number; crop: Crop }
  | { cmd: "harvest"; plot: number }
  | { cmd: "water"; plot: number } // 浇对方岸上的地
  | { cmd: "craft"; out: Item }
  | { cmd: "send"; items: Partial<Record<Item, number>>; note: string }
  | { cmd: "open"; boat: string }
  | { cmd: "contribute"; item: Item; count: number };

export interface ActionResult {
  island: Island;
  /** 需要提醒对方的事 */
  tell?: string;
  leveled?: boolean;
}

/** 执行一个操作，返回新状态；不合法时抛出 INVALID */
export function apply(
  s0: Island,
  seat: Seat,
  a: IslandAction,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): ActionResult {
  const s = clone(s0),
    bag = s.bags[seat],
    other = (1 - seat) as Seat;
  switch (a?.cmd) {
    case "plant": {
      const plot = plotOf(s, seat, a.plot),
        crop = CROPS[a.crop as Crop];
      if (!crop || plot.crop || (crop.only !== undefined && crop.only !== seat))
        fail();
      Object.assign(plot, {
        crop: a.crop,
        plantedAt: now,
        readyAt: now + crop.hours * HOUR,
        wateredAt: null,
      });
      return { island: s };
    }
    case "harvest": {
      const plot = plotOf(s, seat, a.plot);
      if (!plot.crop || plot.readyAt > now) fail();
      give(bag, { [plot.crop]: CROPS[plot.crop].yield });
      Object.assign(plot, emptyPlot());
      return { island: s };
    }
    case "water": {
      const plot = plotOf(s, other, a.plot);
      if (!plot.crop || plot.wateredAt !== null || plot.readyAt <= now) fail();
      plot.wateredAt = now;
      plot.readyAt = now + Math.ceil((plot.readyAt - now) / 2);
      return {
        island: s,
        tell: `帮你的${CROPS[plot.crop].name}浇了水`,
      };
    }
    case "craft": {
      const recipe = RECIPES.find((r) => r.out === a.out) ?? fail();
      take(bag, recipe.needs);
      give(bag, { [recipe.out]: 1 });
      return { island: s };
    }
    case "send": {
      const entries = Object.entries(a.items ?? {});
      const note = typeof a.note === "string" ? a.note.trim() : fail();
      if ([...note].length > NOTE_MAX || entries.length > 3) fail();
      if (!entries.length && !note) fail();
      for (const [k, n] of entries)
        if (!ITEMS.includes(k as Item) || !count(n, 99)) fail();
      take(bag, BOAT_COST);
      take(bag, a.items);
      s.boats.push({
        id: newId(),
        from: seat,
        items: { ...a.items },
        note,
        sentAt: now,
        arrivesAt: now + BOAT_MS,
      });
      return { island: s, tell: "放了一只纸船，大约 1 小时后靠岸" };
    }
    case "open": {
      const i = s.boats.findIndex(
        (b) => b.id === a.boat && b.from === other && b.arrivesAt <= now,
      );
      if (i < 0) fail();
      give(bag, s.boats[i].items);
      s.boats.splice(i, 1);
      return { island: s };
    }
    case "contribute": {
      if (s.level >= MAX_LEVEL || !count(a.count, 99)) fail();
      const needs = upgradeNeeds(s.level),
        want = (needs[a.item] ?? 0) - (s.box[a.item] ?? 0);
      if (a.count > want) fail();
      take(bag, { [a.item]: a.count });
      give(s.box, { [a.item]: a.count });
      if (!has(s.box, needs)) return { island: s };
      s.level++;
      s.box = {};
      for (const side of [0, 1] as Seat[])
        while (s.plots[side].length < plotCount(s.level))
          s.plots[side].push(emptyPlot());
      return { island: s, tell: `把岛升到了 ${s.level} 级`, leveled: true };
    }
  }
  fail();
}
