// Canvas painting helpers for the cartoon look (sky, clouds, ground, props).
import { INK } from "./critter";
// iOS 15 and older WebViews lack roundRect; the cartoon props rely on it.
const proto = CanvasRenderingContext2D.prototype as any;
if (!proto.roundRect)
  proto.roundRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | number[] = 0,
  ) {
    const radius = Math.min(
      Array.isArray(r) ? r[0] || 0 : r,
      Math.abs(w) / 2,
      Math.abs(h) / 2,
    );
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
export { INK };
export type Sky = "day" | "night" | "dusk";
/** Sizes the backing store for crisp drawing and maps logical units to it. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  maxRatio = 2.5,
) {
  const ratio = Math.min(window.devicePixelRatio || 1, maxRatio),
    w = Math.round(width * ratio),
    h = Math.round(height * ratio);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}
export function sky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: Sky = "day",
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops =
    kind === "night"
      ? ["#131A44", "#2A3279", "#4C4FA3"]
      : kind === "dusk"
        ? ["#7D7BFF", "#FF9CC2", "#FFD59E"]
        : ["#56B6FF", "#9FD9FF", "#DDF4FF"];
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.62, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function cloudPath(x: number, y: number, w: number) {
  const h = w * 0.46,
    p = new Path2D();
  const blobs: [number, number, number][] = [
    [0.2, 0.66, 0.36],
    [0.4, 0.4, 0.5],
    [0.64, 0.42, 0.46],
    [0.84, 0.68, 0.32],
    [0.5, 0.72, 0.4],
  ];
  for (const [bx, by, br] of blobs) {
    p.moveTo(x + w * bx + h * br, y + h * by);
    p.arc(x + w * bx, y + h * by, h * br, 0, Math.PI * 2);
  }
  return { p, h };
}
export function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alpha = 1,
) {
  const { p, h } = cloudPath(x, y, w);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#A7D5F5";
  ctx.lineWidth = Math.max(2, w * 0.035);
  ctx.stroke(p);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill(p);
  ctx.clip(p);
  ctx.fillStyle = "#E4F3FF";
  ctx.fillRect(x - w * 0.2, y + h * 0.78, w * 1.4, h);
  ctx.restore();
}
export function stars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  offset = 0,
) {
  for (let i = 0; i < 46; i++) {
    const x = (i * 97.3) % w,
      y = (((i * 61.7 + offset) % h) + h) % h,
      twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time / 700 + i));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 7 === 0 ? "#FFE58A" : "#FFFFFF";
    const r = i % 7 === 0 ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
/** Two layers of rolling hills whose tops sit around baseY. */
export function hills(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  depth: number,
  night = false,
) {
  const layers = night
    ? [
        ["#2E4A78", "#22385E", 0.0],
        ["#24405F", "#1A2F49", 0.35],
      ]
    : [
        ["#A6E07A", "#7CC655", 0.0],
        ["#79CC50", "#4FAE38", 0.35],
      ];
  layers.forEach(([top, bottom, shift], li) => {
    const y = baseY + li * depth * 0.28,
      g = ctx.createLinearGradient(0, y - depth * 0.4, 0, y + depth);
    g.addColorStop(0, top as string);
    g.addColorStop(1, bottom as string);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, y + depth * 2);
    const bumps = 3;
    ctx.lineTo(0, y);
    for (let i = 0; i < bumps; i++) {
      const x0 = (i / bumps) * w,
        x1 = ((i + 1) / bumps) * w,
        lift = depth * (0.35 + 0.25 * Math.sin((i + (shift as number)) * 2.4));
      ctx.bezierCurveTo(
        x0 + (x1 - x0) * 0.3,
        y - lift,
        x0 + (x1 - x0) * 0.7,
        y - lift,
        x1,
        y,
      );
    }
    ctx.lineTo(w, y + depth * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = night ? "#1A2946" : "#3F9A2C";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
const speck = (x: number, y: number, i: number) =>
  ((Math.imul(x * 374761393 + y * 668265263 + i * 1442695041, 1274126177) >>>
    0) %
    1000) /
  1000;
/** One 16px tile of soil; exposed sides get outlines, an exposed top gets grass. */
export function groundTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  size: number,
  open: { top: boolean; left: boolean; right: boolean; bottom: boolean },
  grassy = true,
) {
  const x = tx * size,
    y = ty * size;
  ctx.fillStyle = "#A8703F";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#8E5A31";
  for (let i = 0; i < 2; i++) {
    const sx = x + 2 + speck(tx, ty, i) * (size - 5),
      sy = y + 4 + speck(ty, tx, i + 3) * (size - 7);
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (open.left) {
    ctx.moveTo(x + 0.8, y);
    ctx.lineTo(x + 0.8, y + size);
  }
  if (open.right) {
    ctx.moveTo(x + size - 0.8, y);
    ctx.lineTo(x + size - 0.8, y + size);
  }
  if (open.bottom) {
    ctx.moveTo(x, y + size - 0.8);
    ctx.lineTo(x + size, y + size - 0.8);
  }
  ctx.stroke();
  if (open.top && grassy) {
    ctx.fillStyle = "#6FCB45";
    ctx.beginPath();
    ctx.moveTo(x - (open.left ? 1.5 : 0), y - 1.5);
    ctx.lineTo(x + size + (open.right ? 1.5 : 0), y - 1.5);
    ctx.lineTo(x + size + (open.right ? 1.5 : 0), y + 5);
    for (let i = 3; i >= 0; i--) {
      const bx = x + (size / 4) * i + size / 8;
      ctx.quadraticCurveTo(bx + 2, y + 9.5, bx - 2, y + 5);
    }
    ctx.lineTo(x - (open.left ? 1.5 : 0), y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3F8F27";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "#A6EB6F";
    ctx.fillRect(x, y - 0.5, size, 1.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - (open.left ? 1.5 : 0), y - 1.5);
    ctx.lineTo(x + size + (open.right ? 1.5 : 0), y - 1.5);
    ctx.stroke();
  } else if (open.top) {
    ctx.beginPath();
    ctx.moveTo(x, y + 0.8);
    ctx.lineTo(x + size, y + 0.8);
    ctx.stroke();
  }
}
export function plank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h = 6,
) {
  ctx.fillStyle = "#E3A45F";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h, 2.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#F6C789";
  ctx.fillRect(x + 2, y + 1.6, w - 4, 1.4);
  ctx.fillStyle = "#9C6332";
  for (let i = x + 4; i < x + w - 2; i += 16) {
    ctx.beginPath();
    ctx.arc(i, y + h / 2 + 0.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}
export function cloudPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  cloud(ctx, x - 3, y - 5, w + 6);
}
export function iceBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = "#BDEBFF";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + size - 4);
  ctx.lineTo(x + size - 5, y + 3);
  ctx.lineTo(x + size - 2, y + 3);
  ctx.lineTo(x + 6, y + size - 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#4A9CC9";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.7, y + 0.7, size - 1.4, size - 1.4);
}
export function crumbleBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = "#F0CB82";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#B4823C";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 2);
  ctx.lineTo(x + 7, y + 8);
  ctx.lineTo(x + 5, y + 14);
  ctx.moveTo(x + 7, y + 8);
  ctx.lineTo(x + 13, y + 10);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.7, y + 0.7, size - 1.4, size - 1.4);
}
export function spring(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  squash = 0,
) {
  const top = y + 3 + squash * 4;
  ctx.strokeStyle = "#7A8597";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const yy = top + 3 + ((y + size - 3 - (top + 3)) * i) / 4;
    ctx.lineTo(x + (i % 2 ? size - 4 : 4), yy);
  }
  ctx.stroke();
  ctx.fillStyle = "#FF5D6C";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 1, top, size - 2, 4.5, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6C7486";
  ctx.beginPath();
  ctx.roundRect(x + 2, y + size - 3.5, size - 4, 3.5, 1.5);
  ctx.fill();
  ctx.stroke();
}
export function spikes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = "#DDE3EE";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const bx = x + (size / 3) * i;
    ctx.moveTo(bx, y + size);
    ctx.lineTo(bx + size / 6, y + size * 0.35);
    ctx.lineTo(bx + size / 3, y + size);
  }
  ctx.fill();
  ctx.stroke();
}
export function flag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  active: boolean,
  time: number,
) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + size);
  ctx.lineTo(x + 4, y - size * 0.5);
  ctx.stroke();
  const wave = Math.sin(time / 180) * 1.5;
  ctx.fillStyle = active ? "#FF5D7A" : "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x + 4.5, y - size * 0.5);
  ctx.quadraticCurveTo(x + 11, y - size * 0.4 + wave, x + 17, y - size * 0.25);
  ctx.quadraticCurveTo(x + 11, y - size * 0.05 - wave, x + 4.5, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (active) heart(ctx, x + 10, y - size * 0.26, 2.6, "#FFFFFF", null);
}
export function heartPath(x: number, y: number, r: number) {
  const p = new Path2D();
  p.moveTo(x, y + r * 0.95);
  p.bezierCurveTo(x - r * 1.6, y - r * 0.15, x - r * 0.85, y - r * 1.25, x, y - r * 0.45);
  p.bezierCurveTo(x + r * 0.85, y - r * 1.25, x + r * 1.6, y - r * 0.15, x, y + r * 0.95);
  p.closePath();
  return p;
}
export function heart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill = "#FF4D6A",
  stroke: string | null = INK,
  shine = true,
) {
  const p = heartPath(x, y, r);
  ctx.fillStyle = fill;
  ctx.fill(p);
  if (shine) {
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.48, y - r * 0.38, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.2, r * 0.16);
    ctx.lineJoin = "round";
    ctx.stroke(p);
  }
}
export function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill = "#FFD23F",
  stroke: string | null = INK,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
  }
}
/** Rainbow wooden bridge for the goal (鹊桥). */
export function bridgeTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  index: number,
) {
  const colors = ["#FF6B6B", "#FFA94D", "#FFD43B", "#69DB7C", "#4DABF7", "#9775FA"];
  ctx.fillStyle = colors[((index % 6) + 6) % 6];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, size - 1, size * 0.55, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillRect(x + 2.5, y + 2, size - 5, 1.8);
}
export function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pressed: boolean,
) {
  ctx.fillStyle = "#8A93A6";
  ctx.fillRect(x, y + size * 0.55, size, size * 0.45);
  ctx.fillStyle = pressed ? "#69DB7C" : "#FF8FB1";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + (pressed ? size * 0.42 : size * 0.22), size - 4, size * 0.3, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeRect(x + 0.7, y + size * 0.55, size - 1.4, size * 0.45 - 0.7);
}
export function door(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = "#B97A45";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#7E4A22";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y);
  ctx.lineTo(x + size / 2, y + size);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.7, y + 0.7, size - 1.4, size - 1.4);
  heart(ctx, x + size / 2, y + size / 2, 3.2, "#FF6B8B", INK, false);
}
/** Big outlined game text, e.g. combo popups and countdowns. */
export function chunkyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  fill = "#FFD23F",
  stroke = "#7A3A0A",
  align: CanvasTextAlign = "center",
) {
  ctx.save();
  ctx.font =
    px + 'px "DuoLatin", "DuoDisplay", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, px * 0.22);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.fillText(text, x, y + px * 0.09);
  ctx.strokeText(text, x, y + px * 0.09);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}
/** Rope between two points: sags when slack, straightens and trembles when taut. */
export function rope(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  length: number,
  time: number,
  color = "#E8364F",
) {
  const gap = Math.hypot(bx - ax, by - ay),
    slack = Math.max(0, length - gap),
    sag = Math.min(
      length * 0.2,
      Math.sqrt(Math.max(0, length * length - gap * gap)) * 0.5,
    ),
    tremble = slack < 2 ? Math.sin(time / 30) * 0.8 : 0;
  const mx = (ax + bx) / 2,
    my = (ay + by) / 2 + sag + tremble;
  for (const [c, wd] of [
    [INK, 4.2],
    [color, 2.4],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = wd;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 0.6);
  ctx.quadraticCurveTo(mx, my - 0.6, bx, by - 0.6);
  ctx.stroke();
}
