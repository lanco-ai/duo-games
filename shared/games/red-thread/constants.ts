export const Q = 256;
export const TILE = 16 * Q;
export const HZ = 60;
export const HALF_W = 5 * Q;
export const HALF_H = 7 * Q;
export const GRAVITY = 82;
export const MAX_FALL = 7 * Q;
export const RUN = 2 * Q;
export const GROUND_ACCEL = 90;
export const AIR_ACCEL = 51;
export const JUMP = -1434;
export const COYOTE = 6;
export const JUMP_BUFFER = 6;
export const STAMINA = 240;
export const LEFT = 1;
export const RIGHT = 2;
export const JUMP_KEY = 4;
export const DOWN = 8;
export const GRAB = 16;
export const GROUNDED = 1;
export const WALL = 2;
export const GRABBING = 4;
export const HANGING = 8;
/** Positions are character centers in Q8; y increases downward. */
export const STATE = {
  TICK: 0,
  DEATH_DELAY: 1,
  DEATHS: 2,
  HEARTS: 3,
  RESCUES: 4,
  CHECK_X: 5,
  CHECK_Y: 6,
  GOAL_HOLD: 7,
  WON: 8,
  MIN_Y: 9,
  PLATES: 10,
  DOORS: 11,
  RNG: 12,
  HEIGHT_ORIGIN: 13,
} as const;
export const PLAYER_BASE = 32;
export const PLAYER_STRIDE = 16;
export const P = {
  X: 0,
  Y: 1,
  VX: 2,
  VY: 3,
  FLAGS: 4,
  STAMINA: 5,
  COYOTE: 6,
  BUFFER: 7,
  INPUT: 8,
  HANG_TICKS: 9,
  HANG_JUMP: 10,
  GRAB_LOCK: 11,
} as const;
export const BASE_LENGTH = PLAYER_BASE + PLAYER_STRIDE * 2;
export const playerIndex = (seat: number, field: number) =>
  PLAYER_BASE + seat * PLAYER_STRIDE + field;
