import type { Seat } from "./protocol";
export interface Commitment<T> {
  answers: [T | null, T | null];
  revealAt: number;
}
export function commitment<T>(): Commitment<T> {
  return { answers: [null, null], revealAt: 0 };
}
export function commit<T>(
  state: Commitment<T>,
  seat: Seat,
  answer: T,
  now: number,
) {
  if (state.answers[seat] !== null || state.revealAt)
    throw new Error("INVALID");
  state.answers[seat] = answer;
  if (state.answers.every((a) => a !== null)) state.revealAt = now + 800;
}
export function committedView<T>(s: Commitment<T>, seat: Seat) {
  return {
    submitted: s.answers.map((a) => a !== null),
    own: s.answers[seat],
    answers: s.revealAt ? s.answers : null,
    revealAt: s.revealAt,
  };
}
