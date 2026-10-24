import { describe, it, expect, vi, afterEach } from "vitest";
import { Clock } from "../../shared/clock";
import { transition } from "../../shared/room";
import { Store } from "../../server/store";
import { RoomManager, type Peer } from "../../server/rooms";
import type { ServerMessage, Profile } from "../../shared/protocol";
const a: Profile = { nickname: "小鹿", avatar: "🐰", color: "#FF6B6B" },
  b: Profile = { nickname: "阿北", avatar: "🐻", color: "#4D9DFF" };
function setup() {
  const store = new Store(":memory:"),
    m = new RoomManager(store),
    host = m.create(a);
  m.join(host.code, b);
  const r = m.require(host.code);
  const messages: ServerMessage[] = [];
  const peer = (): Peer => ({
    send: (x) => messages.push(structuredClone(x)),
    close: () => {},
    rtt: 0,
    lastSeen: Date.now(),
  });
  m.connect(r, 0, peer());
  m.connect(r, 1, peer());
  return { m, r, messages, host };
}
afterEach(() => vi.useRealTimers());
describe("clock", () => {
  it("uses the least delayed of the most recent 8 samples", () => {
    const c = new Clock();
    c.sample(100, 1100, 120);
    expect(c.offset).toBe(990);
    c.sample(150, 1200, 550);
    expect(c.offset).toBe(990);
    for (let i = 0; i < 8; i++) c.sample(1000 + i, 6000 + i, 1020 + i);
    expect(c.offset).toBe(4990);
  });
});
describe("room state and reconnect", () => {
  it("same-game proposals enter intro and crossed accept/decline is harmless", () => {
    const { m, r } = setup();
    let v = transition(
      r.view,
      0,
      { type: "propose", gameId: "talk-cards" },
      0,
    ).room;
    v = transition(v, 1, { type: "propose", gameId: "talk-cards" }, 1).room;
    expect(v.phase).toBe("intro");
    expect(transition(v, 0, { type: "decline" }, 2).changed).toBeUndefined();
    expect(transition(v, 1, { type: "accept" }, 3).changed).toBeUndefined();
    m.close();
  });
  it("only proposer changes settings and changes clear ready", () => {
    const { m, r } = setup();
    m.act(r, 0, "propose-001", { type: "propose", gameId: "talk-cards" });
    m.act(r, 1, "accept-0001", { type: "accept" });
    m.act(r, 1, "ready-00001", { type: "ready" });
    m.act(r, 1, "setting-001", {
      type: "settings",
      settings: { decks: ["未来"], limit: 20 },
    });
    expect(r.view.settings.limit).toBe(10);
    m.act(r, 0, "setting-002", {
      type: "settings",
      settings: { decks: ["未来"], limit: 20 },
    });
    expect(r.view.ready).toEqual([false, false]);
    expect(r.view.settings.limit).toBe(20);
    m.close();
  });
  it("replays aid idempotently, rejects stale draw, and preserves card across 30s outage", () => {
    vi.useFakeTimers();
    const { m, r, messages } = setup();
    m.act(r, 0, "propose-001", { type: "propose", gameId: "talk-cards" });
    m.act(r, 1, "accept-0001", { type: "accept" });
    m.act(r, 0, "ready-00000", { type: "ready" });
    m.act(r, 1, "ready-00001", { type: "ready" });
    vi.advanceTimersByTime(3500);
    expect(r.view.phase).toBe("playing");
    m.act(r, 0, "stale-draw1", { type: "draw" }, r.view.seq - 1);
    expect(messages.at(-1)).toMatchObject({
      t: "ack",
      ok: false,
      err: "STALE",
    });
    m.act(r, 0, "draw-00001", { type: "draw" }, r.view.seq);
    const original = structuredClone(r.game),
      seq = r.view.seq;
    m.act(r, 0, "draw-00001", { type: "draw" }, seq - 1);
    expect(r.view.seq).toBe(seq);
    expect(r.game).toEqual(original);
    m.disconnect(r, 1, r.peers[1]!);
    expect(r.view.phase).toBe("paused");
    vi.advanceTimersByTime(30000);
    expect(r.view.phase).toBe("paused");
    const peer = {
      send: () => {},
      close: () => {},
      lastSeen: Date.now(),
      rtt: 0,
    };
    m.connect(r, 1, peer);
    expect(r.view.phase).toBe("countdown");
    vi.advanceTimersByTime(3500);
    expect(r.view.phase).toBe("playing");
    expect(r.game).toEqual(original);
    m.close();
  });
  it("a 60s outage ends the match and retains the two seats", () => {
    vi.useFakeTimers();
    const { m, r } = setup();
    m.act(r, 0, "propose-001", { type: "propose", gameId: "talk-cards" });
    m.act(r, 1, "accept-0001", { type: "accept" });
    m.act(r, 0, "ready-00000", { type: "ready" });
    m.act(r, 1, "ready-00001", { type: "ready" });
    vi.advanceTimersByTime(3500);
    m.disconnect(r, 1, r.peers[1]!);
    vi.advanceTimersByTime(60000);
    expect(r.view.result?.aborted).toBe(true);
    expect(r.view.profiles[1]).toEqual(b);
    m.close();
  });
  it("one-time device handoff revokes old token and survives stale close events", () => {
    const { m, r, host } = setup();
    const old = r.peers[0]!,
      link = m.transfer(r, 0);
    const data = m.rebind(r, link);
    expect(() => m.auth(r, host.token)).toThrow("BAD_TOKEN");
    expect(m.auth(r, data.token)).toBe(0);
    expect(() => m.rebind(r, link)).toThrow("BAD_TOKEN");
    const fresh = {
      send: () => {},
      close: () => {},
      lastSeen: Date.now(),
      rtt: 0,
    };
    m.connect(r, 0, fresh);
    m.disconnect(r, 0, old);
    expect(r.view.online[0]).toBe(true);
    m.close();
  });
  it("joining an occupied seat and copying the partner color are rejected", () => {
    const { m, r } = setup();
    expect(() => m.join(r.data.code, b)).toThrow("ROOM_FULL");
    m.close();
    const n = new RoomManager(new Store(":memory:")),
      data = n.create(a);
    expect(() => n.join(data.code, { ...b, color: a.color })).toThrow(
      "INVALID",
    );
    n.close();
  });
  it("backend switches are presence-only for talk cards", () => {
    const { m, r } = setup();
    r.view.phase = "playing";
    m.visibility(r, 1, true);
    expect(r.view.phase).toBe("playing");
    expect(r.view.away[1]).toBe(true);
    m.close();
  });
  it("only hashed tokens are stored and expired rooms are removed with journal", () => {
    vi.useFakeTimers();
    const { m, r, host } = setup();
    expect(JSON.stringify(m.store.get(host.code))).not.toContain(host.token);
    m.store.addAnswer(host.code, {
      id: "entry",
      cardId: "1-01",
      question: "问题",
      text: "回答",
      seat: 0,
      at: Date.now(),
    });
    vi.advanceTimersByTime(31 * 86400000);
    m.store.expire(Date.now() - 30 * 86400000);
    expect(m.store.get(host.code)).toBeNull();
    expect(m.store.journal(host.code)).toEqual([]);
    m.close();
  });
});

it("bounds welcome frames below 16KB even with full unicode histories", () => {
  const { m, r } = setup();
  r.view.chat = Array.from({ length: 50 }, (_, i) => ({
    id: String(i),
    seat: 0,
    at: 0,
    text: "\u0001".repeat(200),
  }));
  r.view.journal = Array.from({ length: 2 }, (_, i) => ({
    id: String(i),
    cardId: "1-01",
    question: "问题",
    text: "\u0001".repeat(300),
    seat: 0,
    at: 0,
  }));
  r.view.favorites = [
    Array.from({ length: 160 }, (_, i) => String(i)),
    Array.from({ length: 160 }, (_, i) => String(i)),
  ];
  const message = {
    t: "welcome",
    seat: 0,
    now: Date.now(),
    room: m.snapshot(r),
    game: { favorites: r.view.favorites },
  };
  expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThan(16384);
  expect(m.snapshot(r).chat.length).toBeLessThan(50);
  expect(r.view.chat).toHaveLength(50);
  m.close();
});
it("journal paging retains access to answers beyond the first 100", () => {
  const { m, r } = setup();
  for (let i = 0; i < 125; i++)
    m.store.addAnswer(r.data.code, {
      id: String(i),
      cardId: "1-01",
      question: "问题",
      text: "回答" + i,
      seat: 0,
      at: i,
    });
  expect(m.store.journalCount(r.data.code)).toBe(125);
  expect(m.store.journal(r.data.code, 0)).toHaveLength(50);
  expect(m.store.journal(r.data.code, 100)).toHaveLength(25);
  expect(m.store.journal(r.data.code, 100).at(-1)?.text).toBe("回答0");
  m.close();
});
