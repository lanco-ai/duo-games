import { randomBytes, randomInt } from "node:crypto";
import { COLORS, type Profile, type Seat } from "../shared/protocol";
import type { RoomManager } from "./rooms";

type Assignment = { code: string; seat: Seat; token: string };
type Entry = {
  ticket: string;
  clientId: string;
  profile: Profile;
  touched: number;
  assignment?: Assignment;
};

/** Ephemeral queue: room credentials are only returned to their own ticket. */
export class Matchmaking {
  private entries = new Map<string, Entry>();
  private clients = new Map<string, string>();
  constructor(private rooms: RoomManager) {}

  expire(now = Date.now()) {
    for (const entry of this.entries.values()) {
      const lifetime = entry.assignment ? 120_000 : 25_000;
      if (now - entry.touched > lifetime) this.remove(entry);
    }
  }

  private remove(entry: Entry) {
    this.entries.delete(entry.ticket);
    if (this.clients.get(entry.clientId) === entry.ticket)
      this.clients.delete(entry.clientId);
  }

  start(clientId: string, profile: Profile, now = Date.now()) {
    this.expire(now);
    if (!/^[a-f0-9]{32}$/.test(clientId)) throw new Error("INVALID");
    const previous = this.clients.get(clientId);
    if (previous) return { ticket: previous };
    if (this.entries.size >= 500) throw new Error("RATE_LIMITED");
    const entry: Entry = {
      ticket: randomBytes(32).toString("hex"),
      clientId,
      profile,
      touched: now,
    };
    this.entries.set(entry.ticket, entry);
    this.clients.set(clientId, entry.ticket);
    const candidates = [...this.entries.values()].filter(
      (other) => other !== entry && !other.assignment,
    );
    if (candidates.length) {
      const other = candidates[randomInt(candidates.length)];
      const host = this.rooms.create(other.profile);
      const guestProfile = {
        ...entry.profile,
        color:
          entry.profile.color === other.profile.color
            ? COLORS.find((c) => c !== other.profile.color)!
            : entry.profile.color,
      };
      const guest = this.rooms.join(host.code, guestProfile);
      other.assignment = host;
      entry.assignment = guest;
      other.touched = entry.touched = now;
    }
    return { ticket: entry.ticket };
  }

  status(ticket: string, now = Date.now()) {
    this.expire(now);
    const entry = this.entries.get(ticket);
    if (!entry) throw new Error("BAD_TOKEN");
    entry.touched = now;
    if (entry.assignment && this.clients.get(entry.clientId) === ticket)
      this.clients.delete(entry.clientId);
    return entry.assignment
      ? { status: "matched" as const, ...entry.assignment }
      : { status: "waiting" as const };
  }

  cancel(ticket: string, now = Date.now()) {
    this.expire(now);
    const entry = this.entries.get(ticket);
    if (!entry) return { status: "cancelled" as const };
    // Once paired, return the assignment instead of abandoning the partner.
    if (entry.assignment) return this.status(ticket, now);
    this.remove(entry);
    return { status: "cancelled" as const };
  }
}
