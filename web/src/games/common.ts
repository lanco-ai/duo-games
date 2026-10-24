import { useEffect, useRef } from "preact/hooks";
import type { Action, RoomView, Seat } from "../../../shared/protocol";
import type { ExtraView, ExtraEvent } from "../../../shared/games/types";
import type { Transport } from "../net/transport";
export interface GameProps {
  view: ExtraView;
  seat: Seat;
  room: RoomView;
  now: number;
  transport: Transport;
  send: (a: Action) => Promise<boolean>;
  disabled: boolean;
  code: string;
  token: string;
}
export function useGame(p: GameProps) {
  return (command: string, payload: any = {}) =>
    p.send({ type: "game", run: p.view.run, command, payload });
}
export function useEvents(p: GameProps, callback: (e: ExtraEvent) => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(
    () =>
      p.transport.subscribe((m) => {
        if (m.t === "extra" && m.event.run === p.view.run) ref.current(m.event);
      }),
    [p.transport, p.view.run],
  );
}
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
export function useFrame(draw: (time: number) => void) {
  const ref = useLatest(draw);
  useEffect(() => {
    let id: number;
    const next = (t: number) => {
      ref.current(t);
      id = requestAnimationFrame(next);
    };
    id = requestAnimationFrame(next);
    return () => cancelAnimationFrame(id);
  }, []);
}
export function nickname(p: GameProps, seat: number) {
  return p.room.profiles[seat as Seat]?.nickname || "TA";
}
export function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
      target.isContentEditable)
  );
}
