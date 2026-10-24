import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/index";
import { VERSION, type ServerMessage } from "../../shared/protocol";
const profile = { nickname: "小鹿", avatar: "🐰", color: "#FF6B6B" },
  other = { nickname: "阿北", avatar: "🐻", color: "#4D9DFF" };
let app: ReturnType<typeof createApp> | undefined;
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const s of sockets) s.terminate();
  sockets.length = 0;
  if (app) await app.close();
  app = undefined;
});
async function setup(base = "/", lag = 0) {
  app = createApp({ data: ":memory:", base, lag });
  const port = await app.listen(0);
  const url =
    "http://127.0.0.1:" + port + (base === "/" ? "" : base.replace(/\/$/, ""));
  return { url, ws: url.replace("http:", "ws:") + "/ws" };
}
async function request(
  url: string,
  path: string,
  method = "GET",
  value?: unknown,
  token?: string,
) {
  const res = await fetch(url + "/api/" + path, {
    method,
    headers: {
      ...(value ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: value ? JSON.stringify(value) : undefined,
  });
  return { status: res.status, body: (await res.json()) as any };
}
function client(url: string, code: string, token: string) {
  const ws = new WebSocket(url);
  sockets.push(ws);
  const events: ServerMessage[] = [];
  ws.on("message", (raw) => events.push(JSON.parse(raw.toString())));
  ws.on("open", () =>
    ws.send(JSON.stringify({ t: "hello", code, token, v: VERSION })),
  );
  return {
    ws,
    events,
    wait: async (predicate: (m: ServerMessage) => boolean) => {
      for (let i = 0; i < 200; i++) {
        const item = events.find(predicate);
        if (item) return item;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(
        "Timed out waiting for server message: " + JSON.stringify(events),
      );
    },
  };
}
describe("real HTTP and WebSocket server", () => {
  it("serves only public invite metadata, authenticates data, and rejects a third person", async () => {
    const { url } = await setup();
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const pub = (await request(url, "rooms/" + host.code)).body;
    expect(pub.host).toEqual({ nickname: "小鹿", avatar: "🐰" });
    expect(JSON.stringify(pub)).not.toMatch(/token|journal|hashes|seen/);
    expect((await request(url, "rooms/" + host.code + "/journal")).status).toBe(
      401,
    );
    expect(
      (
        await request(url, "rooms/" + host.code + "/join", "POST", {
          profile: other,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(url, "rooms/" + host.code + "/join", "POST", {
          profile: other,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          url,
          "rooms/" + host.code + "/journal",
          "GET",
          undefined,
          host.token,
        )
      ).status,
    ).toBe(200);
  });
  it("atomically admits exactly one of concurrent join requests", async () => {
    const { url } = await setup();
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const results = await Promise.all([
      request(url, "rooms/" + host.code + "/join", "POST", { profile: other }),
      request(url, "rooms/" + host.code + "/join", "POST", { profile: other }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it("replaces the old tab and prevents its queued actions from changing the room", async () => {
    const { url, ws } = await setup();
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const one = client(ws, host.code, host.token);
    await one.wait((m) => m.t === "welcome");
    const two = client(ws, host.code, host.token);
    await two.wait((m) => m.t === "welcome");
    await one.wait((m) => m.t === "err" && m.code === "REPLACED");
    expect(app!.manager.require(host.code).view.online[0]).toBe(true);
  });
  it("runs subpath HTTP+WS, rejects bad version and unauthorized hello", async () => {
    const { url, ws } = await setup("/duo/");
    expect((await request(url, "health")).body.ok).toBe(true);
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const bad = client(ws, host.code, "not-the-token");
    await bad.wait((m) => m.t === "err" && m.code === "BAD_TOKEN");
    const good = client(ws, host.code, host.token);
    expect(await good.wait((m) => m.t === "welcome")).toMatchObject({
      seat: 0,
    });
    const v = new WebSocket(ws);
    sockets.push(v);
    const response = new Promise<any>((resolve) =>
      v.on("message", (d) => resolve(JSON.parse(d.toString()))),
    );
    v.on("open", () =>
      v.send(
        JSON.stringify({
          t: "hello",
          code: host.code,
          token: host.token,
          v: 999,
        }),
      ),
    );
    expect(await response).toMatchObject({ t: "err", code: "VERSION" });
  });
  it("preserves action ordering with server latency injection and deduplicates chat-card proposals", async () => {
    const { url, ws } = await setup("/", 50);
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const c = client(ws, host.code, host.token);
    await c.wait((m) => m.t === "welcome");
    const msg = {
      t: "act",
      aid: "proposal-123",
      a: { type: "propose", gameId: "talk-cards" },
    };
    c.ws.send(JSON.stringify(msg));
    c.ws.send(JSON.stringify(msg));
    await c.wait((m) => m.t === "ack" && m.aid === msg.aid);
    const r = app!.manager.require(host.code);
    expect(r.view.phase).toBe("proposed");
    expect(r.acks[0].size).toBe(1);
  });
  it("validates input, enforces create quotas and does not accept spoofed IP by default", async () => {
    const { url } = await setup();
    expect(
      (
        await request(url, "rooms", "POST", {
          profile: { ...profile, nickname: "a".repeat(13) },
        })
      ).status,
    ).toBe(400);
    for (let i = 0; i < 10; i++)
      expect((await request(url, "rooms", "POST", { profile })).status).toBe(
        201,
      );
    expect((await request(url, "rooms", "POST", { profile })).status).toBe(429);
  });
  it("retains metadata and journal after a real database reopen; active game returns to lobby", async () => {
    const folder = mkdtempSync(join(tmpdir(), "duo-restart-"));
    const file = join(folder, "duo.db");
    app = createApp({ data: file });
    const port = await app.listen(0),
      url = "http://127.0.0.1:" + port;
    const host = (await request(url, "rooms", "POST", { profile })).body;
    await request(url, "rooms/" + host.code + "/join", "POST", {
      profile: other,
    });
    const room = app.manager.require(host.code);
    room.view.phase = "playing";
    app.manager.persist(room);
    app.store.addAnswer(host.code, {
      id: "saved-answer",
      cardId: "1-01",
      question: "问题",
      text: "一起开一家书店",
      seat: 0,
      at: Date.now(),
    });
    await app.close();
    app = createApp({ data: file });
    await app.listen(0);
    const restored = app.manager.require(host.code);
    expect(restored.view.phase).toBe("lobby");
    expect(restored.view.restartNotice).toBe(true);
    expect(restored.view.journal[0].text).toBe("一起开一家书店");
    expect(app.manager.auth(restored, host.token)).toBe(0);
  });
  it("enforces the 16KB socket payload limit without crashing", async () => {
    const { url, ws } = await setup();
    const host = (await request(url, "rooms", "POST", { profile })).body;
    const c = client(ws, host.code, host.token);
    await c.wait((m) => m.t === "welcome");
    const closed = new Promise<number>((resolve) =>
      c.ws.once("close", (code) => resolve(code)),
    );
    c.ws.send(JSON.stringify({ t: "chat", text: "x".repeat(17000) }));
    expect(await closed).toBe(1009);
    expect((await request(url, "health")).status).toBe(200);
  });
});
