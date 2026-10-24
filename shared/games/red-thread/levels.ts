export interface Point {
  x: number;
  y: number;
}
export interface MovingPlatform extends Point {
  width: number;
  dx: number;
  dy: number;
  period: number;
  phase?: number;
}
export interface Level {
  id: string;
  name: string;
  seed: number;
  width: number;
  height: number;
  tiles: string[];
  ropeLength: number;
  stamina: boolean;
  endless: boolean;
  spawn: [Point, Point];
  moving: MovingPlatform[];
  flags: Point[];
  goals: Point[];
  hearts: Point[];
  dualHearts: number[];
  crumbles: Point[];
  crumbleIndex: number[];
  heartIndex: number[];
}
const names = ["相识", "暧昧", "热恋", "相守"];
export function noise(seed: number, n: number): number {
  let v = Math.imul(seed ^ n, 1597334677);
  v = Math.imul(v ^ (v >>> 16), 2246822507);
  return (v ^ (v >>> 13)) >>> 0;
}
/** Build immutable lookup data, also useful for tiny physics fixtures. */
export function levelFromTiles(
  tiles: string[],
  options: Partial<Level> = {},
): Level {
  const width = tiles[0].length,
    height = tiles.length;
  if (!tiles.every((row) => row.length === width))
    throw new Error("Unequal level rows");
  const flags: Point[] = [],
    goals: Point[] = [],
    hearts: Point[] = [],
    crumbles: Point[] = [];
  const spawn: [Point, Point] = [
    { x: 5 * 16, y: (height - 2) * 16 - 7 },
    { x: 7 * 16, y: (height - 2) * 16 - 7 },
  ];
  const heartIndex = new Array<number>(width * height).fill(-1),
    crumbleIndex = heartIndex.slice();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x],
        point = { x: x * 16 + 8, y: y * 16 + 8 };
      if (t === "1" || t === "2") spawn[t === "1" ? 0 : 1] = point;
      if (t === "F") flags.push(point);
      if (t === "G") goals.push(point);
      if (t === "H") {
        heartIndex[y * width + x] = hearts.length;
        hearts.push(point);
      }
      if (t === "C") {
        crumbleIndex[y * width + x] = crumbles.length;
        crumbles.push(point);
      }
    }
  return {
    id: "acquaintance",
    name: names[0],
    seed: 1,
    width,
    height,
    tiles,
    ropeLength: 88,
    stamina: false,
    endless: false,
    spawn,
    moving: [],
    flags,
    goals,
    hearts,
    dualHearts: [],
    crumbles,
    crumbleIndex,
    heartIndex,
    ...options,
  };
}
const centres = [4, 6, 8, 10, 12, 14, 14, 12, 10, 8, 6, 4];
/** Infinite mode generates rows above the stored preview, rather than ending at its top. */
export function tileAt(level: Level, x: number, y: number): string {
  if (x < 0 || x >= level.width) return "#";
  if (!level.endless)
    return y < 0 || y >= level.height ? "." : level.tiles[y][x];
  if (x === 0 || x === level.width - 1) return "#";
  const bottom = level.height - 2;
  if (y === bottom) return "#";
  if (y > bottom) return ".";
  const delta = bottom - y,
    segment = Math.floor(delta / 2);
  const centre =
    centres[((segment % centres.length) + centres.length) % centres.length];
  const shift = (noise(level.seed, Math.floor(segment / 12)) % 3) - 1;
  if (delta % 2 === 0) {
    if (x >= centre + shift - 2 && x <= centre + shift + 2)
      return segment % 11 === 7 ? "I" : segment % 13 === 9 ? "S" : "=";
  } else {
    const nextCentre =
      centres[
        (((segment + 1) % centres.length) + centres.length) % centres.length
      ];
    const nextShift =
      (noise(level.seed, Math.floor((segment + 1) / 12)) % 3) - 1;
    if (x === nextCentre + nextShift) {
      if ((segment + 1) % 10 === 0) return "F";
      if ((segment + 1) % 3 === 1) return "H";
    }
  }
  return ".";
}
/** Four tall, forgiving but mechanically distinct hand-authored climbing courses. */
export function createLevel(id: string, seed = 1): Level {
  const aliases: Record<string, number> = {
    "1": 1,
    acquaintance: 1,
    meet: 1,
    相识: 1,
    "2": 2,
    flirt: 2,
    ambiguity: 2,
    暧昧: 2,
    "3": 3,
    passion: 3,
    love: 3,
    热恋: 3,
    "4": 4,
    together: 4,
    companionship: 4,
    相守: 4,
  };
  const endless = ["endless", "infinite", "∞", "无尽攀登", "5"].includes(id);
  const number = aliases[id] || 1,
    width = 20,
    height = endless ? 180 : 150 + (number - 1) * 20;
  const rows = Array.from({ length: height }, () =>
    Array<string>(width).fill("."),
  );
  for (let y = 0; y < height; y++) {
    rows[y][0] = "#";
    rows[y][width - 1] = "#";
  }
  rows[height - 2].fill("#");
  const moving: MovingPlatform[] = [];
  let last = 5;
  for (let y = height - 4, stage = 0; y >= 4; y -= 2, stage++) {
    const centre = centres[stage % centres.length];
    let material = "=";
    if (number === 3)
      material =
        stage % 8 === 2
          ? "I"
          : stage % 8 === 4
            ? "C"
            : stage % 8 === 6
              ? "S"
              : "=";
    for (let x = centre - 2; x <= centre + 2; x++) rows[y][x] = material;
    if (stage % 8 === 0) rows[y - 1][centre] = "F";
    else if (stage % 3 === 1) rows[y - 1][centre] = "H";
    if (number >= 2 && stage % 14 === 8) {
      // A moving platform bridges the outer detour; the main route remains recoverable.
      moving.push({
        x: (centre > 9 ? 2 : 14) * 16,
        y: (y - 1) * 16,
        width: 48,
        dx: centre > 9 ? 48 : -48,
        dy: -16,
        period: 180,
        phase: stage * 7,
      });
      rows[y - 2][centre > 9 ? 3 : 15] = "H";
    }
    if (number >= 3 && stage % 15 === 10)
      rows[y - 1][centre > 9 ? 2 : 17] = "^";
    last = y;
  }
  for (let x = 2; x <= 17; x++) rows[last + 2][x] = "=";
  // The last platform is one continuous bridge so both characters can stand on it.
  for (let x = 4; x <= 15; x++) rows[last][x] = "G";
  if (number === 4) {
    const y = height - 12;
    for (let x = 4; x <= 14; x++) rows[y][x] = "=";
    rows[y][6] = "P";
    rows[y][10] = "P";
    // Once both plates are occupied the gate latches; leaving a plate cannot trap a partner.
    for (let x = 1; x < width - 1; x++) rows[y - 3][x] = "D";
    rows[y - 2][7] = "#";
    rows[y - 2][9] = "#";
  }
  const level = levelFromTiles(
    rows.map((r) => r.join("")),
    {
      id: endless ? "endless" : id,
      name: endless ? "无尽攀登" : names[number - 1],
      seed,
      stamina: number !== 1 || endless,
      endless,
      moving,
      spawn: [
        { x: 72, y: (height - 2) * 16 - 7 },
        { x: 104, y: (height - 2) * 16 - 7 },
      ],
    },
  );
  // A few hearts ask both players to visit them, and remain visibly half collected.
  level.dualHearts = level.hearts.map((_, i) => i).filter((i) => i % 5 === 3);
  if (endless) {
    level.hearts = [];
    level.dualHearts = [];
    level.crumbles = [];
    level.heartIndex.fill(-1);
    level.crumbleIndex.fill(-1);
    level.flags = [];
    level.goals = [];
    level.tiles = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => tileAt(level, x, y)).join(""),
    );
  }
  return level;
}
