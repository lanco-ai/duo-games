import { hashInts, isqrt } from "../../fixed";
import { tileAt, type Level } from "./levels";
import {
  Q,
  TILE,
  HALF_W,
  HALF_H,
  GRAVITY,
  MAX_FALL,
  RUN,
  GROUND_ACCEL,
  AIR_ACCEL,
  JUMP,
  COYOTE,
  JUMP_BUFFER,
  STAMINA,
  LEFT,
  RIGHT,
  JUMP_KEY,
  DOWN,
  GRAB,
  GROUNDED,
  WALL,
  GRABBING,
  HANGING,
  STATE,
  P,
  BASE_LENGTH,
  playerIndex,
} from "./constants";
export * from "./constants";
export { tileAt } from "./levels";
const RING_SIZE = 128;
const crumbStart = BASE_LENGTH;
const heartStart = (l: Level) => crumbStart + l.crumbles.length;
const ringStart = (l: Level) => heartStart(l) + l.hearts.length;
const at = playerIndex;
export const hash = hashInts;

/** The complete mutable simulation state is this array; static Level data is immutable. */
export function init(level: Level): Int32Array {
  const s = new Int32Array(
    ringStart(level) + (level.endless ? RING_SIZE * 2 : 0),
  );
  s[STATE.RNG] = level.seed;
  s[STATE.CHECK_X] = Math.floor(
    ((level.spawn[0].x + level.spawn[1].x) * Q) / 2,
  );
  s[STATE.CHECK_Y] = Math.floor(
    ((level.spawn[0].y + level.spawn[1].y) * Q) / 2,
  );
  s[STATE.MIN_Y] = s[STATE.CHECK_Y];
  s[STATE.HEIGHT_ORIGIN] = s[STATE.CHECK_Y];
  for (let seat = 0; seat < 2; seat++) {
    s[at(seat, P.X)] = level.spawn[seat].x * Q;
    s[at(seat, P.Y)] = level.spawn[seat].y * Q;
    s[at(seat, P.STAMINA)] = STAMINA;
  }
  if (level.endless)
    for (let i = 0; i < RING_SIZE; i++)
      s[ringStart(level) + i * 2] = -2147483648;
  return s;
}
export function platformPosition(level: Level, index: number, tick: number) {
  const p = level.moving[index],
    period = Math.max(2, p.period),
    half = Math.floor(period / 2);
  const phase = (((tick + (p.phase || 0)) % period) + period) % period;
  const amount = phase <= half ? phase : period - phase;
  return {
    x: p.x * Q + Math.floor((p.dx * Q * amount) / half),
    y: p.y * Q + Math.floor((p.dy * Q * amount) / half),
    width: p.width * Q,
  };
}
function material(s: Int32Array, level: Level, x: number, y: number) {
  const t = tileAt(level, x, y);
  if (t === "D" && s[STATE.DOORS]) return ".";
  if (t === "C") {
    const i = level.crumbleIndex[y * level.width + x];
    if (i !== undefined && i >= 0 && s[crumbStart + i] < 0) return ".";
  }
  return t;
}
function solid(t: string) {
  return (
    t === "#" ||
    t === "S" ||
    t === "I" ||
    t === "C" ||
    t === "G" ||
    t === "P" ||
    t === "D"
  );
}
export function renderTile(s: Int32Array, l: Level, x: number, y: number) {
  const t = material(s, l, x, y);
  if (t !== "H") return t;
  if (l.endless) {
    const index =
      ringStart(l) + (((y % RING_SIZE) + RING_SIZE) % RING_SIZE) * 2;
    return s[index] === y && s[index + 1] ? "." : "H";
  }
  const i = l.heartIndex[y * l.width + x];
  const mask = s[heartStart(l) + i];
  return (l.dualHearts.includes(i) ? mask === 3 : !!mask) ? "." : "H";
}
function nearby(
  s: Int32Array,
  l: Level,
  seat: number,
  callback: (t: string, x: number, y: number) => void,
  feet = false,
) {
  const px = s[at(seat, P.X)],
    py = s[at(seat, P.Y)];
  const x0 = Math.floor((px - HALF_W + 1) / TILE),
    x1 = Math.floor((px + HALF_W - 1) / TILE);
  const y0 = Math.floor((py - HALF_H + 1) / TILE),
    y1 = Math.floor((py + HALF_H + (feet ? 1 : -1)) / TILE);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) callback(material(s, l, x, y), x, y);
}
/** Swept movement is split into <=4px pieces; even a long rope correction cannot tunnel. */
function moveAxis(
  s: Int32Array,
  l: Level,
  seat: number,
  amount: number,
  vertical: boolean,
  drop = false,
) {
  const field = vertical ? P.Y : P.X,
    velocity = vertical ? P.VY : P.VX;
  let remaining = Math.trunc(amount),
    collided = false;
  while (remaining !== 0) {
    const delta = Math.max(-4 * Q, Math.min(4 * Q, remaining));
    const old = s[at(seat, field)],
      oldBottom = s[at(seat, P.Y)] + HALF_H;
    s[at(seat, field)] += delta;
    let resolved = s[at(seat, field)];
    nearby(s, l, seat, (t, tx, ty) => {
      if (
        !solid(t) &&
        !(
          vertical &&
          delta > 0 &&
          t === "=" &&
          !drop &&
          oldBottom <= ty * TILE + 1
        )
      )
        return;
      if (vertical) {
        const boundary =
          delta > 0 ? ty * TILE - HALF_H : (ty + 1) * TILE + HALF_H;
        resolved =
          delta > 0
            ? Math.min(resolved, boundary)
            : Math.max(resolved, boundary);
      } else {
        const boundary =
          delta > 0 ? tx * TILE - HALF_W : (tx + 1) * TILE + HALF_W;
        resolved =
          delta > 0
            ? Math.min(resolved, boundary)
            : Math.max(resolved, boundary);
      }
    });
    if (vertical && delta > 0 && !drop)
      for (let i = 0; i < l.moving.length; i++) {
        const p = platformPosition(l, i, s[STATE.TICK]);
        const px = s[at(seat, P.X)],
          bottom = s[at(seat, P.Y)] + HALF_H;
        if (
          oldBottom <= p.y + 1 &&
          bottom > p.y &&
          px + HALF_W > p.x &&
          px - HALF_W < p.x + p.width
        )
          resolved = Math.min(resolved, p.y - HALF_H);
      }
    if (resolved !== s[at(seat, field)]) {
      s[at(seat, field)] = resolved;
      s[at(seat, velocity)] = 0;
      collided = true;
      if (vertical && delta > 0) s[at(seat, P.FLAGS)] |= GROUNDED;
      if (!vertical) s[at(seat, P.FLAGS)] |= WALL;
      break;
    }
    remaining -= delta;
    // An actor placed into malformed fixture geometry must not make the loop unbounded.
    if (s[at(seat, field)] === old) break;
  }
  return collided;
}
function contacts(s: Int32Array, l: Level, seat: number) {
  const x = s[at(seat, P.X)],
    y = s[at(seat, P.Y)];
  let flags = 0;
  const foot = Math.floor((y + HALF_H + 1) / TILE);
  for (
    let tx = Math.floor((x - HALF_W + 1) / TILE);
    tx <= Math.floor((x + HALF_W - 1) / TILE);
    tx++
  ) {
    const t = material(s, l, tx, foot);
    if ((solid(t) || t === "=") && Math.abs(y + HALF_H - foot * TILE) <= 2)
      flags |= GROUNDED;
  }
  for (
    let ty = Math.floor((y - HALF_H + 1) / TILE);
    ty <= Math.floor((y + HALF_H - 1) / TILE);
    ty++
  ) {
    const left = Math.floor((x - HALF_W - 1) / TILE),
      right = Math.floor((x + HALF_W + 1) / TILE);
    if (
      solid(material(s, l, left, ty)) &&
      Math.abs(x - HALF_W - (left + 1) * TILE) <= 2
    )
      flags |= WALL;
    if (
      solid(material(s, l, right, ty)) &&
      Math.abs(x + HALF_W - right * TILE) <= 2
    )
      flags |= WALL;
  }
  for (let i = 0; i < l.moving.length; i++) {
    const p = platformPosition(l, i, s[STATE.TICK]);
    if (
      Math.abs(y + HALF_H - p.y) <= 2 &&
      x + HALF_W > p.x &&
      x - HALF_W < p.x + p.width
    )
      flags |= GROUNDED;
  }
  return flags;
}
function carry(s: Int32Array, l: Level, seat: number) {
  if (!s[STATE.TICK]) return;
  const x = s[at(seat, P.X)],
    y = s[at(seat, P.Y)] + HALF_H;
  for (let i = 0; i < l.moving.length; i++) {
    const previous = platformPosition(l, i, s[STATE.TICK] - 1);
    if (
      Math.abs(y - previous.y) <= 3 &&
      x + HALF_W > previous.x &&
      x - HALF_W < previous.x + previous.width
    ) {
      const current = platformPosition(l, i, s[STATE.TICK]);
      moveAxis(s, l, seat, current.x - previous.x, false);
      moveAxis(s, l, seat, current.y - previous.y, true);
      break;
    }
  }
}
function approach(value: number, target: number, acceleration: number) {
  return value < target
    ? Math.min(target, value + acceleration)
    : Math.max(target, value - acceleration);
}
function updatePlayer(s: Int32Array, l: Level, seat: number, input: number) {
  carry(s, l, seat);
  const oldFlags = s[at(seat, P.FLAGS)],
    touching = contacts(s, l, seat);
  s[at(seat, P.FLAGS)] = touching;
  const pressed =
    (input & JUMP_KEY) !== 0 && (s[at(seat, P.INPUT)] & JUMP_KEY) === 0;
  const released =
    (input & JUMP_KEY) === 0 && (s[at(seat, P.INPUT)] & JUMP_KEY) !== 0;
  if (!(input & GRAB)) s[at(seat, P.GRAB_LOCK)] = 0;
  const gripping =
    input & GRAB &&
    touching &&
    s[at(seat, P.STAMINA)] > 0 &&
    !s[at(seat, P.GRAB_LOCK)];
  if (gripping) {
    s[at(seat, P.FLAGS)] |= GRABBING;
    s[at(seat, P.VX)] = 0;
    s[at(seat, P.VY)] = 0;
    if (l.stamina && --s[at(seat, P.STAMINA)] === 0) {
      s[at(seat, P.FLAGS)] &= ~GRABBING;
      s[at(seat, P.GRAB_LOCK)] = 1;
    }
  } else s[at(seat, P.STAMINA)] = Math.min(STAMINA, s[at(seat, P.STAMINA)] + 2);
  s[at(seat, P.COYOTE)] =
    touching & GROUNDED ? COYOTE : Math.max(0, s[at(seat, P.COYOTE)] - 1);
  s[at(seat, P.BUFFER)] = pressed
    ? JUMP_BUFFER
    : Math.max(0, s[at(seat, P.BUFFER)] - 1);
  const other = 1 - seat,
    anchor = s[at(other, P.FLAGS)] & GRABBING;
  const dx = s[at(seat, P.X)] - s[at(other, P.X)],
    dy = s[at(seat, P.Y)] - s[at(other, P.Y)];
  const d = isqrt(dx * dx + dy * dy);
  const hanging =
    anchor &&
    !(s[at(seat, P.FLAGS)] & (GROUNDED | GRABBING)) &&
    (oldFlags & HANGING || d >= l.ropeLength * Q - Q);
  if (hanging) {
    s[at(seat, P.FLAGS)] |= HANGING;
    if (++s[at(seat, P.HANG_TICKS)] === 60) s[STATE.RESCUES]++;
  } else {
    s[at(seat, P.HANG_TICKS)] = 0;
    s[at(seat, P.HANG_JUMP)] = 0;
  }
  const direction = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
  if (!(s[at(seat, P.FLAGS)] & GRABBING)) {
    let ice = false;
    if (touching & GROUNDED)
      nearby(
        s,
        l,
        seat,
        (t) => {
          if (t === "I") ice = true;
        },
        true,
      );
    const accel = touching & GROUNDED ? (ice ? 9 : GROUND_ACCEL) : AIR_ACCEL;
    if (direction)
      s[at(seat, P.VX)] = approach(s[at(seat, P.VX)], direction * RUN, accel);
    else if (touching & GROUNDED)
      s[at(seat, P.VX)] = approach(s[at(seat, P.VX)], 0, accel);
    if (hanging && d > 0) {
      s[at(seat, P.VX)] += Math.trunc((direction * 38 * dy) / d);
      s[at(seat, P.VY)] -= Math.trunc((direction * 38 * dx) / d);
    }
    const climbing = hanging && input & JUMP_KEY && !pressed && d > 12 * Q;
    if (climbing) {
      // Inward velocity shortens the hanging distance; gravity pauses while holding jump.
      s[at(seat, P.VX)] = -Math.trunc((dx * Q) / d);
      s[at(seat, P.VY)] = -Math.trunc((dy * Q) / d);
    } else s[at(seat, P.VY)] = Math.min(MAX_FALL, s[at(seat, P.VY)] + GRAVITY);
    if (s[at(seat, P.BUFFER)] && s[at(seat, P.COYOTE)]) {
      s[at(seat, P.VY)] = JUMP;
      s[at(seat, P.COYOTE)] = 0;
      s[at(seat, P.BUFFER)] = 0;
      s[at(seat, P.FLAGS)] &= ~GROUNDED;
    } else if (hanging && pressed && !s[at(seat, P.HANG_JUMP)]) {
      s[at(seat, P.VY)] = Math.floor((JUMP * 80) / 100);
      s[at(seat, P.HANG_JUMP)] = 1;
      s[at(seat, P.BUFFER)] = 0;
    }
    if (released && s[at(seat, P.VY)] < 0)
      s[at(seat, P.VY)] = Math.floor(s[at(seat, P.VY)] / 2);
    moveAxis(s, l, seat, s[at(seat, P.VX)], false);
    moveAxis(s, l, seat, s[at(seat, P.VY)], true, !!(input & DOWN));
  }
  s[at(seat, P.INPUT)] = input;
}
function rope(s: Int32Array, l: Level) {
  const limit = l.ropeLength * Q;
  for (let iteration = 0; iteration < 5; iteration++) {
    const dx = s[at(1, P.X)] - s[at(0, P.X)],
      dy = s[at(1, P.Y)] - s[at(0, P.Y)];
    const d = isqrt(dx * dx + dy * dy);
    if (!d || d <= limit) break;
    if (s[at(0, P.FLAGS)] & GRABBING && s[at(1, P.FLAGS)] & GRABBING) {
      const release = s[at(0, P.STAMINA)] < s[at(1, P.STAMINA)] ? 0 : 1;
      s[at(release, P.FLAGS)] &= ~GRABBING;
      s[at(release, P.GRAB_LOCK)] = 1;
    }
    const weight = [0, 1].map((seat) =>
      s[at(seat, P.FLAGS)] & GRABBING
        ? 0
        : s[at(seat, P.FLAGS)] & GROUNDED
          ? 1
          : 3,
    );
    const sum = weight[0] + weight[1];
    if (!sum) break;
    const excess = d - limit;
    for (let seat = 0; seat < 2; seat++) {
      const sign = seat === 0 ? 1 : -1;
      moveAxis(
        s,
        l,
        seat,
        Math.trunc((sign * dx * excess * weight[seat]) / (d * sum)),
        false,
      );
      moveAxis(
        s,
        l,
        seat,
        Math.trunc((sign * dy * excess * weight[seat]) / (d * sum)),
        true,
      );
    }
    const vx = s[at(1, P.VX)] - s[at(0, P.VX)],
      vy = s[at(1, P.VY)] - s[at(0, P.VY)];
    const separating = Math.trunc((vx * dx + vy * dy) / d);
    if (separating > 0)
      for (let seat = 0; seat < 2; seat++) {
        const sign = seat === 0 ? 1 : -1;
        s[at(seat, P.VX)] += Math.trunc(
          (sign * dx * separating * weight[seat]) / (d * sum),
        );
        s[at(seat, P.VY)] += Math.trunc(
          (sign * dy * separating * weight[seat]) / (d * sum),
        );
      }
  }
}
function respawn(s: Int32Array) {
  for (let seat = 0; seat < 2; seat++) {
    for (let field = 0; field < 16; field++) s[at(seat, field)] = 0;
    s[at(seat, P.X)] = s[STATE.CHECK_X] + (seat === 0 ? -16 * Q : 16 * Q);
    s[at(seat, P.Y)] = s[STATE.CHECK_Y];
    s[at(seat, P.STAMINA)] = STAMINA;
  }
}
export function step(
  s: Int32Array,
  inputs: [number, number],
  l: Level,
): Int32Array {
  if (s[STATE.WON]) return s;
  if (s[STATE.DEATH_DELAY] > 0) {
    if (--s[STATE.DEATH_DELAY] === 0) respawn(s);
    s[STATE.TICK]++;
    return s;
  }
  for (let i = 0; i < l.crumbles.length; i++) {
    const timer = s[crumbStart + i];
    if (timer > 0) s[crumbStart + i] = timer >= 30 ? -180 : timer + 1;
    else if (timer < 0) s[crumbStart + i] = timer + 1;
  }
  // Grip intent is resolved for both players before either one's hanging forces.
  for (let seat = 0; seat < 2; seat++) {
    if (
      inputs[seat] & GRAB &&
      contacts(s, l, seat) &&
      s[at(seat, P.STAMINA)] > 0 &&
      !s[at(seat, P.GRAB_LOCK)]
    )
      s[at(seat, P.FLAGS)] |= GRABBING;
    else s[at(seat, P.FLAGS)] &= ~GRABBING;
  }
  updatePlayer(s, l, 0, inputs[0] & 31);
  updatePlayer(s, l, 1, inputs[1] & 31);
  rope(s, l);
  let died = false,
    goalMask = 0;
  const plateCells = [-1, -1];
  for (let seat = 0; seat < 2; seat++) {
    const preserved = s[at(seat, P.FLAGS)] & (GRABBING | HANGING);
    s[at(seat, P.FLAGS)] = contacts(s, l, seat) | preserved;
    nearby(s, l, seat, (t, x, y) => {
      if (t === "^") died = true;
      if (t === "F") {
        const cy = y * TILE + TILE / 2;
        if (cy < s[STATE.CHECK_Y]) {
          s[STATE.CHECK_X] = x * TILE + TILE / 2;
          s[STATE.CHECK_Y] = cy;
        }
      }
      if (t !== "H") return;
      let index = l.heartIndex[y * l.width + x],
        dual = false,
        previous = 0;
      if (l.endless) {
        const slot = ((y % RING_SIZE) + RING_SIZE) % RING_SIZE;
        index = ringStart(l) + slot * 2;
        if (s[index] !== y) {
          s[index] = y;
          s[index + 1] = 0;
        }
        index++;
        previous = s[index];
      } else {
        if (index === undefined || index < 0) return;
        dual = l.dualHearts.includes(index);
        index += heartStart(l);
        previous = s[index];
      }
      const next = previous | (1 << seat);
      s[index] = next;
      if (dual ? next === 3 && previous !== 3 : previous === 0)
        s[STATE.HEARTS]++;
    });
    const px = s[at(seat, P.X)],
      py = s[at(seat, P.Y)];
    const feet = Math.floor((py + HALF_H + 1) / TILE);
    if (s[at(seat, P.FLAGS)] & GROUNDED)
      for (
        let x = Math.floor((px - HALF_W + 1) / TILE);
        x <= Math.floor((px + HALF_W - 1) / TILE);
        x++
      ) {
        const t = material(s, l, x, feet);
        if (t === "G") goalMask |= 1 << seat;
        if (t === "P") plateCells[seat] = feet * l.width + x;
        if (t === "S") {
          s[at(seat, P.VY)] = Math.floor((JUMP * 160) / 100);
          s[at(seat, P.FLAGS)] &= ~GROUNDED;
        }
        if (t === "C") {
          const index = l.crumbleIndex[feet * l.width + x];
          if (index >= 0 && s[crumbStart + index] === 0)
            s[crumbStart + index] = 1;
        }
      }
  }
  if (
    plateCells[0] >= 0 &&
    plateCells[1] >= 0 &&
    plateCells[0] !== plateCells[1]
  ) {
    s[STATE.PLATES] = 3;
    s[STATE.DOORS] = 1;
  } else
    s[STATE.PLATES] =
      (plateCells[0] >= 0 ? 1 : 0) | (plateCells[1] >= 0 ? 2 : 0);
  const fail = s[STATE.CHECK_Y] + 12 * TILE;
  if (s[at(0, P.Y)] > fail && s[at(1, P.Y)] > fail) died = true;
  if (died) {
    s[STATE.DEATH_DELAY] = 40;
    s[STATE.DEATHS]++;
    s[STATE.GOAL_HOLD] = 0;
  } else if (goalMask === 3 && !l.endless) {
    if (++s[STATE.GOAL_HOLD] >= 30) s[STATE.WON] = 1;
  } else s[STATE.GOAL_HOLD] = 0;
  s[STATE.MIN_Y] = Math.min(
    s[STATE.MIN_Y],
    Math.floor((s[at(0, P.Y)] + s[at(1, P.Y)]) / 2),
  );
  s[STATE.TICK]++;
  return s;
}
export function read(s: Int32Array) {
  return {
    tick: s[STATE.TICK],
    players: [0, 1].map((seat) => ({
      x: s[at(seat, P.X)] / Q,
      y: s[at(seat, P.Y)] / Q,
      vx: s[at(seat, P.VX)] / Q,
      vy: s[at(seat, P.VY)] / Q,
      grounded: !!(s[at(seat, P.FLAGS)] & GROUNDED),
      grabbing: !!(s[at(seat, P.FLAGS)] & GRABBING),
      hanging: !!(s[at(seat, P.FLAGS)] & HANGING),
      stamina: s[at(seat, P.STAMINA)],
    })),
    deaths: s[STATE.DEATHS],
    hearts: s[STATE.HEARTS],
    rescues: s[STATE.RESCUES],
    height: Math.max(
      0,
      Math.floor((s[STATE.HEIGHT_ORIGIN] - s[STATE.MIN_Y]) / TILE),
    ),
    won: !!s[STATE.WON],
    deathDelay: s[STATE.DEATH_DELAY],
    checkpoint: { x: s[STATE.CHECK_X] / Q, y: s[STATE.CHECK_Y] / Q },
    plates: s[STATE.PLATES],
    doorsOpen: !!s[STATE.DOORS],
  };
}
