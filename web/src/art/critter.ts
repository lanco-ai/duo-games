// Cartoon critters shared by DOM avatars (SVG) and canvas games (Path2D).
// Coordinates live in a 100x100 box; the feet rest on y = 96.
export type Kind = "bunny" | "bear" | "cat" | "dog" | "fox" | "penguin";
export type Mood = "normal" | "joy" | "wow" | "sad";
export type Pose = "stand" | "up";
export const INK = "#3A2618";
export const KINDS: Record<string, Kind> = {
  "🐰": "bunny",
  "🐻": "bear",
  "🐱": "cat",
  "🐶": "dog",
  "🦊": "fox",
  "🐧": "penguin",
};
export const KIND_NAMES: Record<Kind, string> = {
  bunny: "小兔",
  bear: "小熊",
  cat: "小猫",
  dog: "小狗",
  fox: "狐狸",
  penguin: "企鹅",
};
export function kindOf(avatar?: string): Kind {
  return KINDS[avatar || ""] || "bunny";
}
interface Layer {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
  alpha?: number;
}
const K = 0.5522847498;
const n = (v: number) => Math.round(v * 100) / 100;
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
): string {
  const r = (rot * Math.PI) / 180,
    cos = Math.cos(r),
    sin = Math.sin(r);
  const pt = (x: number, y: number) =>
    n(cx + x * cos - y * sin) + "," + n(cy + x * sin + y * cos);
  const p = [
    [rx, 0],
    [0, ry],
    [-rx, 0],
    [0, -ry],
  ];
  const t = [
    [0, ry],
    [-rx, 0],
    [0, -ry],
    [rx, 0],
  ];
  let d = "M" + pt(p[0][0], p[0][1]);
  for (let i = 0; i < 4; i++) {
    const a = p[i],
      b = p[(i + 1) % 4],
      ta = t[i],
      tb = t[(i + 1) % 4];
    d +=
      "C" +
      pt(a[0] + K * ta[0], a[1] + K * ta[1]) +
      " " +
      pt(b[0] - K * tb[0], b[1] - K * tb[1]) +
      " " +
      pt(b[0], b[1]);
  }
  return d + "Z";
}
const FUR: Record<
  Kind,
  { fur: string; light: string; inner: string; foot?: string }
> = {
  bunny: { fur: "#FFF7F2", light: "#FFFFFF", inner: "#FFB3C4" },
  bear: { fur: "#C98B56", light: "#F6DEC0", inner: "#F2C9A0" },
  cat: { fur: "#FFB55E", light: "#FFF4E6", inner: "#FFC9D4" },
  dog: { fur: "#F7E2C3", light: "#FFFFFF", inner: "#A86F45" },
  fox: { fur: "#F7883A", light: "#FFF4E8", inner: "#FFE9D6" },
  penguin: {
    fur: "#34425E",
    light: "#FFFFFF",
    inner: "#FFFFFF",
    foot: "#FFAA33",
  },
};
const mirror = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
    n(100 - Number(x)) + "," + y,
  );
function ears(kind: Kind): { back: Layer[]; front: Layer[] } {
  const f = FUR[kind],
    back: Layer[] = [],
    front: Layer[] = [];
  const pair = (layer: Layer, list: Layer[]) =>
    list.push(layer, { ...layer, d: mirror(layer.d) });
  if (kind === "bunny") {
    pair({ d: ellipse(37, 12, 7, 17, -10), fill: f.fur, stroke: INK }, back);
    pair({ d: ellipse(37.2, 13.5, 3.3, 11.5, -10), fill: f.inner }, back);
  } else if (kind === "bear") {
    pair({ d: ellipse(28.5, 20, 8.5, 8.5), fill: f.fur, stroke: INK }, back);
    pair({ d: ellipse(28.5, 20, 4.6, 4.6), fill: f.inner }, back);
  } else if (kind === "cat") {
    pair({ d: "M23.5,31L26,7.5L44.5,20Z", fill: f.fur, stroke: INK }, back);
    pair({ d: "M27.6,24.5L28.6,13.2L38.6,20.6Z", fill: f.inner }, back);
  } else if (kind === "fox") {
    pair({ d: "M22,32L24.5,4L45,19Z", fill: f.fur, stroke: INK }, back);
    pair({ d: "M26.5,25L27,12L38.5,19.6Z", fill: f.inner }, back);
    pair({ d: "M23.7,12.5L24.5,4L31.2,8.9Z", fill: INK }, back);
  } else if (kind === "dog") {
    pair(
      {
        d: "M26,24C15,22 10,42 14,54C17,61 25,59 28,51L31.5,30Z",
        fill: f.inner,
        stroke: INK,
      },
      front,
    );
  }
  return { back, front };
}
function face(kind: Kind, mood: Mood): Layer[] {
  const f = FUR[kind],
    out: Layer[] = [];
  if (kind === "bear" || kind === "dog")
    out.push({
      d: ellipse(50, 50.5, 12.5, 9),
      fill: f.light,
      stroke: INK,
      width: 1.8,
    });
  if (kind === "dog") out.push({ d: ellipse(61, 38.5, 7, 7.6), fill: "#EBC79C" });
  if (kind === "cat") {
    out.push({ d: ellipse(50, 51.5, 10.5, 7.2), fill: f.light });
    out.push({
      d: "M44,18.5L45,25M50,16.8L50,24M56,18.5L55,25",
      stroke: "#E0852B",
      width: 2.4,
    });
  }
  if (kind === "fox")
    out.push(
      { d: "M21.5,44C24,55 33,59 41,56C38,51 31,49 21.5,44Z", fill: f.light },
      { d: "M78.5,44C76,55 67,59 59,56C62,51 69,49 78.5,44Z", fill: f.light },
      { d: ellipse(50, 51, 11.5, 8), fill: f.light, stroke: INK, width: 1.6 },
    );
  if (kind === "penguin")
    out.push({
      d: "M50,27C42,19 27,24 28,39C29,54 40,61 50,61C60,61 71,54 72,39C73,24 58,19 50,27Z",
      fill: "#FFFFFF",
      stroke: INK,
      width: 1.6,
    });
  if (mood === "joy")
    out.push(
      { d: "M35.5,41.5Q40,35.5 44.5,41.5", stroke: INK, width: 3 },
      { d: "M55.5,41.5Q60,35.5 64.5,41.5", stroke: INK, width: 3 },
    );
  else {
    const big = mood === "wow" ? 1.25 : 1;
    for (const x of [40, 60])
      out.push(
        { d: ellipse(x, 40, 4 * big, 5 * big), fill: INK },
        { d: ellipse(x + 1.4, 38.2, 1.5 * big, 1.7 * big), fill: "#FFFFFF" },
      );
    if (mood === "sad")
      out.push(
        { d: "M34.5,35L44,32", stroke: INK, width: 2.2 },
        { d: "M65.5,35L56,32", stroke: INK, width: 2.2 },
        { d: "M35.5,46C33.5,50.5 38,51.5 37,46.5Z", fill: "#7CCBFF" },
      );
  }
  out.push(
    { d: ellipse(31.5, 49.5, 5, 3), fill: "#FF8FA3", alpha: 0.6 },
    { d: ellipse(68.5, 49.5, 5, 3), fill: "#FF8FA3", alpha: 0.6 },
  );
  if (kind === "penguin")
    out.push({
      d: "M43.5,46.5Q50,43 56.5,46.5Q50,54 43.5,46.5Z",
      fill: "#FFAA33",
      stroke: INK,
      width: 1.6,
    });
  else if (kind === "bunny" || kind === "cat")
    out.push({
      d: "M47.3,46.4L52.7,46.4L50,49.6Z",
      fill: "#FF7F98",
      stroke: INK,
      width: 1.3,
    });
  else
    out.push({ d: ellipse(50, kind === "dog" ? 47 : 47.6, 3.8, 2.7), fill: INK });
  if (kind !== "penguin") {
    if (mood === "wow")
      out.push({
        d: ellipse(50, 54.5, 3, 3.6),
        fill: "#C9364F",
        stroke: INK,
        width: 1.6,
      });
    else if (mood === "joy")
      out.push({
        d: "M45,51.5Q50,59 55,51.5Z",
        fill: "#C9364F",
        stroke: INK,
        width: 1.6,
      });
    else if (mood === "sad")
      out.push({ d: "M45.5,55.5Q50,51.5 54.5,55.5", stroke: INK, width: 1.9 });
    else
      out.push({
        d: "M45.5,51.2Q47.8,54.4 50,51.8Q52.2,54.4 54.5,51.2",
        stroke: INK,
        width: 1.9,
      });
  }
  return out;
}
const cache = new Map<string, Layer[]>();
export function layers(
  kind: Kind,
  color: string,
  mood: Mood = "normal",
  pose: Pose = "stand",
  shadow = true,
): Layer[] {
  const key = [kind, color, mood, pose, shadow].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const f = FUR[kind],
    e = ears(kind),
    out: Layer[] = [];
  if (shadow)
    out.push({ d: ellipse(50, 97, 21, 3.6), fill: "#000000", alpha: 0.16 });
  if (kind === "fox")
    out.push(
      {
        d: "M62,86C81,91 96,75 89,57C84,67 74,71 63,73Z",
        fill: f.fur,
        stroke: INK,
      },
      { d: "M89,57C93.5,63 93,70 90,75C86.5,71 86,64 89,57Z", fill: f.light },
    );
  if (kind === "cat")
    out.push(
      { d: "M63,86C79,89 87,77 81,66", stroke: INK, width: 7.8 },
      { d: "M63,86C79,89 87,77 81,66", stroke: f.fur, width: 4.2 },
    );
  out.push(...e.back);
  const foot = f.foot || f.fur;
  // Arms start at the shoulders and legs tuck under the torso. Draw their
  // roots behind the body so the joints stay connected in both poses.
  const arm = pose === "up"
    ? "M36,68C29,65 23,59 22,52C21,48 16,48 16,53C17,64 24,72 34,76Z"
    : kind === "penguin"
      ? "M36,67C28,69 22,76 23,83C28,84 34,79 37,73Z"
      : "M36,67C30,68 26,72 24,77C22,82 26,85 29,81L37,73Z";
  out.push(
    { d: arm, fill: f.fur, stroke: INK },
    { d: mirror(arm), fill: f.fur, stroke: INK },
    { d: "M37,84L46,84L46,94L37,94Z", fill: foot, stroke: INK },
    { d: "M54,84L63,84L63,94L54,94Z", fill: foot, stroke: INK },
    { d: ellipse(50, 76, 17, 13), fill: f.fur, stroke: INK },
  );
  if (kind !== "bunny")
    out.push({
      d:
        kind === "penguin"
          ? ellipse(50, 77, 11, 10)
          : ellipse(50, 78, 10, 8),
      fill: f.light,
    });
  out.push(
    { d: ellipse(40.5, 94, 7, 3.5), fill: foot, stroke: INK },
    { d: ellipse(59.5, 94, 7, 3.5), fill: foot, stroke: INK },
  );
  out.push(
    {
      d: "M31,60.5C40,67.5 60,67.5 69,60.5L69.5,67C60,74 40,74 30.5,67Z",
      fill: color,
      stroke: INK,
    },
    {
      d: "M57.5,69C59.5,75 62.5,80 65.5,84L58,85.5C56.5,80 55,75 53.5,70Z",
      fill: color,
      stroke: INK,
    },
  );
  out.push({ d: ellipse(50, 41, 29, 25.5), fill: f.fur, stroke: INK });
  out.push(...e.front);
  out.push(...face(kind, mood));
  cache.set(key, out);
  return out;
}
export function critterSVG(
  kind: Kind,
  color: string,
  mood: Mood = "normal",
  pose: Pose = "stand",
  shadow = true,
): string {
  return layers(kind, color, mood, pose, shadow)
    .map(
      (l) =>
        '<path d="' +
        l.d +
        '" fill="' +
        (l.fill || "none") +
        '"' +
        (l.stroke
          ? ' stroke="' +
            l.stroke +
            '" stroke-width="' +
            (l.width || 2.6) +
            '" stroke-linejoin="round" stroke-linecap="round"'
          : "") +
        (l.alpha !== undefined ? ' opacity="' + l.alpha + '"' : "") +
        "/>",
    )
    .join("");
}
const paths = new Map<string, Path2D>();
function path(d: string) {
  let p = paths.get(d);
  if (!p) paths.set(d, (p = new Path2D(d)));
  return p;
}
export interface DrawOptions {
  mood?: Mood;
  pose?: Pose;
  facing?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  shadow?: boolean;
}
// Draws a critter whose feet touch (x, y); size is the box height in pixels.
export function drawCritter(
  ctx: CanvasRenderingContext2D,
  kind: Kind,
  color: string,
  x: number,
  y: number,
  size: number,
  o: DrawOptions = {},
) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (o.facing || 1) * (o.sx || 1), s * (o.sy || 1));
  ctx.translate(-50, -96);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const base = o.alpha ?? 1;
  for (const l of layers(kind, color, o.mood, o.pose, o.shadow ?? true)) {
    ctx.globalAlpha = base * (l.alpha ?? 1);
    const p = path(l.d);
    if (l.fill) {
      ctx.fillStyle = l.fill;
      ctx.fill(p);
    }
    if (l.stroke) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.width || 2.6;
      ctx.stroke(p);
    }
  }
  ctx.restore();
}
