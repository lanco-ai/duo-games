import { Q, isqrt } from "../../fixed";
export { Q } from "../../fixed";
/** Board in pixels. Seat 0 owns the lower half, seat 1 the upper half. */
export const WIDTH = 360;
export const HEIGHT = 640;
export const HZ = 60;
export const RADIUS = 14;
export const MID = 320;
export const WALL = 6;
export const GAP_LEFT = 150;
export const GAP_RIGHT = 210;
export const PER_SIDE = 5;
export const MAX_PULL = 100;
export const MIN_PULL = 12;
/** Ticks one seat must wait between two shots. */
export const COOLDOWN = 18;
/** Velocities are Q8 pixels per substep; four substeps make one tick. */
const SUB = 4;
const MAX_V = 4 * Q;
const EDGE_E = 200;
const PUCK_E = 230;
export interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface State {
  tick: number;
  pucks: Puck[];
}
export interface Shot {
  tick: number;
  seat: 0 | 1;
  id: number;
  dx: number;
  dy: number;
}
export function initial(): State {
  const pucks: Puck[] = [];
  for (const seat of [0, 1])
    for (let i = 0; i < PER_SIDE; i++) {
      const x = 60 + i * 60,
        y = 560 - (i % 2) * 70;
      pucks.push({ x: x * Q, y: (seat ? HEIGHT - y : y) * Q, vx: 0, vy: 0 });
    }
  return { tick: 0, pucks };
}
export function clone(s: State): State {
  return { tick: s.tick, pucks: s.pucks.map((p) => ({ ...p })) };
}
/** Which half a puck sits on; the midline belongs to seat 0. */
export function sideOf(p: Puck): 0 | 1 {
  return p.y >= MID * Q ? 0 : 1;
}
export function counts(s: State): [number, number] {
  const c: [number, number] = [0, 0];
  for (const p of s.pucks) c[sideOf(p)]++;
  return c;
}
/** A puck can be slung only from well inside its owner's half. */
export function grabbable(p: Puck, seat: 0 | 1) {
  const reach = (RADIUS + WALL + 4) * Q;
  return seat === 0 ? p.y > MID * Q + reach : p.y < MID * Q - reach;
}
/** Pull is the drag from the puck towards the shooter's own baseline, in whole pixels. */
export function validPull(seat: 0 | 1, dx: number, dy: number) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return false;
  const l2 = dx * dx + dy * dy;
  if (l2 < MIN_PULL * MIN_PULL || l2 > MAX_PULL * MAX_PULL) return false;
  // Must be pulled back so the puck flies towards the partner's half.
  return seat === 0 ? dy * 2 > Math.abs(dx) : -dy * 2 > Math.abs(dx);
}
export function clampPull(seat: 0 | 1, dx: number, dy: number) {
  let x = dx,
    y = dy;
  const l = Math.hypot(x, y);
  if (l > MAX_PULL) {
    x = (x / l) * MAX_PULL;
    y = (y / l) * MAX_PULL;
  }
  x = Math.round(x);
  y = Math.round(y);
  return validPull(seat, x, y) ? { dx: x, dy: y } : null;
}
function launch(p: Puck, dx: number, dy: number) {
  p.vx = -Math.trunc((dx * MAX_V) / MAX_PULL);
  p.vy = -Math.trunc((dy * MAX_V) / MAX_PULL);
}
function bounceRect(p: Puck, x0: number, x1: number, y0: number, y1: number) {
  const r = RADIUS * Q,
    cx = Math.max(x0, Math.min(x1, p.x)),
    cy = Math.max(y0, Math.min(y1, p.y)),
    dx = p.x - cx,
    dy = p.y - cy,
    d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return;
  let nx: number, ny: number, d: number;
  if (d2 === 0) {
    nx = 0;
    ny = p.y < (y0 + y1) / 2 ? -Q : Q;
    d = 0;
    p.y = ny < 0 ? y0 - r : y1 + r;
  } else {
    d = isqrt(d2);
    nx = Math.trunc((dx * Q) / d);
    ny = Math.trunc((dy * Q) / d);
    p.x += Math.trunc((nx * (r - d)) / Q);
    p.y += Math.trunc((ny * (r - d)) / Q);
  }
  const vn = Math.trunc((p.vx * nx + p.vy * ny) / Q);
  if (vn < 0) {
    const k = vn + Math.trunc((vn * EDGE_E) / Q);
    p.vx -= Math.trunc((k * nx) / Q);
    p.vy -= Math.trunc((k * ny) / Q);
  }
}
function substep(pucks: Puck[]) {
  const r = RADIUS * Q,
    right = WIDTH * Q - r,
    bottom = HEIGHT * Q - r;
  for (const p of pucks) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < r) {
      p.x = r;
      p.vx = Math.trunc((Math.abs(p.vx) * EDGE_E) / Q);
    } else if (p.x > right) {
      p.x = right;
      p.vx = -Math.trunc((Math.abs(p.vx) * EDGE_E) / Q);
    }
    if (p.y < r) {
      p.y = r;
      p.vy = Math.trunc((Math.abs(p.vy) * EDGE_E) / Q);
    } else if (p.y > bottom) {
      p.y = bottom;
      p.vy = -Math.trunc((Math.abs(p.vy) * EDGE_E) / Q);
    }
    const y0 = (MID - WALL) * Q,
      y1 = (MID + WALL) * Q;
    bounceRect(p, -r, GAP_LEFT * Q, y0, y1);
    bounceRect(p, GAP_RIGHT * Q, WIDTH * Q + r, y0, y1);
  }
  for (let i = 0; i < pucks.length; i++)
    for (let j = i + 1; j < pucks.length; j++) {
      const a = pucks[i],
        b = pucks[j],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d2 = dx * dx + dy * dy,
        min = 2 * r;
      if (d2 >= min * min) continue;
      let nx = Q,
        ny = 0,
        d = 0;
      if (d2 > 0) {
        d = isqrt(d2);
        nx = Math.trunc((dx * Q) / d);
        ny = Math.trunc((dy * Q) / d);
      }
      const push = Math.trunc((min - d) / 2) + 1;
      a.x -= Math.trunc((nx * push) / Q);
      a.y -= Math.trunc((ny * push) / Q);
      b.x += Math.trunc((nx * push) / Q);
      b.y += Math.trunc((ny * push) / Q);
      const rv = Math.trunc(((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) / Q);
      if (rv >= 0) continue;
      const k = Math.trunc(
        ((rv + Math.trunc((rv * PUCK_E) / Q)) * Q) / (2 * Q),
      );
      a.vx += Math.trunc((k * nx) / Q);
      a.vy += Math.trunc((k * ny) / Q);
      b.vx -= Math.trunc((k * nx) / Q);
      b.vy -= Math.trunc((k * ny) / Q);
    }
}
/** Rolling drag plus a little sliding friction so slow pucks come to rest. */
function slow(v: number) {
  const next = v - Math.trunc((v * 5) / Q) - Math.sign(v) * 2;
  return Math.sign(next) === Math.sign(v) ? next : 0;
}
/** One 60 Hz tick: shots stamped with this tick fire first, then motion and table friction. */
export function step(s: State, shots: Shot[]) {
  for (const shot of shots)
    if (shot.tick === s.tick) launch(s.pucks[shot.id], shot.dx, shot.dy);
  for (let i = 0; i < SUB; i++) substep(s.pucks);
  for (const p of s.pucks) {
    p.vx = slow(p.vx);
    p.vy = slow(p.vy);
    if (Math.abs(p.vx) + Math.abs(p.vy) < 16) p.vx = p.vy = 0;
  }
  s.tick++;
}
/** Advances a copy of `from` to `tick`, replaying every shot in order. */
export function advance(from: State, shots: Shot[], tick: number): State {
  const s = clone(from);
  while (s.tick < tick) step(s, shots);
  return s;
}
export function moving(s: State) {
  return s.pucks.some((p) => p.vx || p.vy);
}
