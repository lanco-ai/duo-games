import { Q } from "../../fixed";
export { Q } from "../../fixed";
export const WIDTH = 360;
export const HEIGHT = 640;
export const HZ = 60;
export const RADIUS = 10;
export const PADDLE_Y = 568;
export const PADDLE_WIDTH = 76;
export const GRAVITY = 64;
export const MAX_VX = 8 * Q;
export interface Hit {
  n: number;
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Q8 acceleration, selected deterministically once per flight. */
  wind?: number;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tick: number;
}
export function windFor(seed: number, n: number, combo: number) {
  if (combo < 30) return 0;
  let h = Math.imul(seed ^ n, 1597334677);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return h & 1 ? 6 : -6;
}
/** Public records and ball coordinates use Q8 integers, tick is relative to the game epoch. */
export function serve(n: number, tick: number): Hit {
  return { n, tick: tick + 60, x: 180 * Q, y: 36 * Q, vx: 0, vy: Q, wind: 0 };
}
export function simulate(hit: Hit, ticks: number): Ball {
  let x = hit.x,
    y = hit.y,
    vx = hit.vx,
    vy = hit.vy;
  const duration = Math.max(0, Math.floor(ticks)),
    left = RADIUS * Q,
    right = (WIDTH - RADIUS) * Q;
  for (let i = 0; i < duration; i++) {
    vx = Math.max(-MAX_VX, Math.min(MAX_VX, vx + (hit.wind || 0)));
    x += vx;
    y += vy;
    vy += GRAVITY;
    while (x < left || x > right) {
      if (x < left) {
        x = 2 * left - x;
        vx = Math.abs(vx);
      }
      if (x > right) {
        x = 2 * right - x;
        vx = -Math.abs(vx);
      }
    }
    if (y < RADIUS * Q) {
      y = 2 * RADIUS * Q - y;
      vy = Math.abs(vy);
    }
  }
  return { x, y, vx, vy, tick: hit.tick + duration };
}
export function ballAt(hit: Hit, tick: number): Ball {
  return simulate(hit, tick - hit.tick);
}
export function paddleX(value: number, width = PADDLE_WIDTH) {
  return Math.max(width / 2, Math.min(WIDTH - width / 2, value));
}
/** Checks the descending sweep, so fast balls cannot tunnel through a paddle. */
export function canHit(
  hit: Hit,
  tick: number,
  paddleCentrePixels: number,
  width = PADDLE_WIDTH,
): boolean {
  if (tick <= hit.tick) return false;
  const previous = ballAt(hit, tick - 1),
    current = ballAt(hit, tick),
    line = (PADDLE_Y - RADIUS) * Q;
  return (
    current.vy > 0 &&
    previous.y <= line &&
    current.y >= line &&
    Math.abs(current.x - paddleX(paddleCentrePixels, width) * Q) <=
      (width / 2 + RADIUS) * Q
  );
}
export function launchSpeed(combo: number) {
  const percent = Math.min(160, 100 + Math.floor(combo / 10) * 8);
  // Minimum 7px/tick and g=.25 guarantee >=56 ticks, exceeding the 0.8s handoff budget.
  return Math.min(11 * Q, Math.floor((7 * Q * percent) / 100));
}
export function makeHit(
  previous: Hit,
  tick: number,
  centrePixels: number,
  combo: number,
  seed = 1,
  width = PADDLE_WIDTH,
): Hit | null {
  if (!canHit(previous, tick, centrePixels, width)) return null;
  const ball = ballAt(previous, tick),
    offset = ball.x - paddleX(centrePixels, width) * Q;
  return {
    n: previous.n + 1,
    tick,
    x: ball.x,
    y: (PADDLE_Y - RADIUS) * Q,
    vx: Math.max(-MAX_VX, Math.min(MAX_VX, Math.floor((offset * 5) / 32))),
    vy: -launchSpeed(combo),
    wind: windFor(seed, previous.n + 1, combo),
  };
}
/** First descending crossing; finite cap rejects malformed nonphysical records. */
export function crossingTick(
  hit: Hit,
  yPixels: number,
  maxTicks = 1800,
): number {
  const line = yPixels * Q;
  let previous = ballAt(hit, hit.tick);
  for (let elapsed = 1; elapsed <= maxTicks; elapsed++) {
    const ball = ballAt(hit, hit.tick + elapsed);
    if (ball.vy > 0 && previous.y <= line && ball.y >= line)
      return hit.tick + elapsed;
    previous = ball;
  }
  return hit.tick + maxTicks;
}
export function paddleTick(hit: Hit) {
  return crossingTick(hit, PADDLE_Y - RADIUS);
}
export function missTick(hit: Hit) {
  return crossingTick(hit, HEIGHT + RADIUS);
}
export function fallbackTick(hit: Hit) {
  return missTick(hit) + 90;
}
export function validRecord(hit: Hit): boolean {
  return (
    [hit.n, hit.tick, hit.x, hit.y, hit.vx, hit.vy, hit.wind ?? 0].every(
      Number.isSafeInteger,
    ) &&
    hit.n >= 0 &&
    hit.tick >= 0 &&
    hit.x >= RADIUS * Q &&
    hit.x <= (WIDTH - RADIUS) * Q &&
    hit.y >= RADIUS * Q &&
    hit.y <= HEIGHT * Q &&
    Math.abs(hit.vx) <= MAX_VX &&
    Math.abs(hit.vy) <= 16 * Q &&
    Math.abs(hit.wind || 0) <= 6
  );
}
/** Check a claimed owner hit against the previous deterministic trajectory. */
export function validateHit(
  previous: Hit,
  candidate: Hit,
  combo: number,
  seed = 1,
): boolean {
  if (
    !validRecord(candidate) ||
    candidate.n !== previous.n + 1 ||
    candidate.tick <= previous.tick
  )
    return false;
  const ball = ballAt(previous, candidate.tick),
    prev = ballAt(previous, candidate.tick - 1);
  const line = (PADDLE_Y - RADIUS) * Q;
  if (!(prev.y <= line && ball.y >= line && ball.vy > 0)) return false;
  return (
    candidate.x === ball.x &&
    candidate.y === line &&
    candidate.vy === -launchSpeed(combo) &&
    (candidate.wind || 0) === windFor(seed, candidate.n, combo)
  );
}
