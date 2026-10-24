import type { Seat } from "./protocol";
export interface Consent<T = unknown> {
  kind: string;
  by: Seat;
  payload: T;
}
export function respond<T>(
  pending: Consent<T> | null,
  seat: Seat,
  accept: boolean,
): T | null {
  if (!pending || pending.by === seat) throw new Error("INVALID");
  return accept ? pending.payload : null;
}
