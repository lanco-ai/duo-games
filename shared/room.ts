import { isExtra } from "./games/types";
import {
  validSettings,
  type Action,
  type ErrCode,
  type RoomView,
  type Seat,
} from "./protocol";
export function requiresForeground(gameId: string | undefined) {
  return (
    gameId === "red-thread" ||
    gameId === "heart-bounce" ||
    gameId === "puck-sling"
  );
}

export function readyBlockReason(room: RoomView) {
  if (!room.online.every(Boolean)) return "PARTNER_OFFLINE";
  if (requiresForeground(room.proposal?.gameId) && room.away.some(Boolean))
    return "FOREGROUND_REQUIRED";
}

export function transition(
  room: RoomView,
  seat: Seat,
  a: Action,
  now: number,
): { room: RoomView; error?: ErrCode; changed?: boolean; start?: boolean } {
  const r = structuredClone(room),
    fail = (error: ErrCode) => ({ room, error });
  const reset = () => {
    r.phase = r.profiles[1] ? "lobby" : "waiting";
    r.proposal = null;
    r.ready = [false, false];
    r.rematch = [false, false];
    r.startAt = null;
    r.pauseDeadline = null;
    r.result = null;
  };
  switch (a.type) {
    case "propose":
      if (a.gameId !== "talk-cards" && !isExtra(a.gameId))
        return fail("UNAVAILABLE");
      if (!["waiting", "lobby", "proposed"].includes(r.phase))
        return fail("INVALID");
      if (
        r.phase === "proposed" &&
        r.proposal?.gameId === a.gameId &&
        r.proposal.by !== seat
      ) {
        r.phase = "intro";
        r.ready = [false, false];
      } else {
        r.phase = "proposed";
        r.proposal = { gameId: a.gameId, by: seat };
      }
      break;
    case "accept":
      if (r.phase !== "proposed") return { room };
      if (!r.profiles[1] || r.proposal?.by === seat) return fail("INVALID");
      r.phase = "intro";
      r.ready = [false, false];
      break;
    case "decline":
      if (r.phase !== "proposed") return { room };
      reset();
      break;
    case "cancel":
      if (r.phase !== "intro") return { room };
      reset();
      break;
    case "settings":
      if (
        r.phase !== "intro" ||
        r.proposal?.by !== seat ||
        !validSettings(a.settings)
      )
        return fail("INVALID");
      r.settings = a.settings;
      r.ready = [false, false];
      break;
    case "ready":
      if (r.phase !== "intro") return { room };
      if (r.ready[seat]) return { room };
      const blocked = readyBlockReason(r);
      if (blocked) return fail(blocked);
      r.ready[seat] = true;
      if (r.ready.every(Boolean)) {
        r.phase = "countdown";
        r.startAt = now + 3500;
        return { room: r, changed: true, start: true };
      }
      break;
    case "rematch":
      if (r.phase !== "result") return { room };
      r.rematch[seat] = true;
      if (r.rematch.every(Boolean)) {
        r.phase = "intro";
        r.ready = [false, false];
        r.rematch = [false, false];
        r.result = null;
      }
      break;
    case "lobby":
      if (!["result", "paused"].includes(r.phase)) return fail("INVALID");
      reset();
      break;
    default:
      return fail("INVALID");
  }
  return { room: r, changed: true };
}
