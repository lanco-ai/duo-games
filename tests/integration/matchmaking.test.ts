import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/index";
import { Matchmaking } from "../../server/matchmaking";

const alice = { nickname: "小鹿", avatar: "🐰", color: "#FF6B6B" };
const bob = { nickname: "小熊", avatar: "🐻", color: "#FF6B6B" };
const a = "a".repeat(32),
  b = "b".repeat(32),
  c = "c".repeat(32);
let app: ReturnType<typeof createApp> | undefined;
afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe("random matchmaking", () => {
  it("pairs once, keeps credentials private, resolves color clashes and supports cancellation", async () => {
    app = createApp({ data: ":memory:", base: "/duo/" });
    const port = await app.listen(0);
    const base = `http://127.0.0.1:${port}/duo/api/`;
    const request = async (
      method: string,
      payload?: object,
      ticket?: string,
    ) => {
      const response = await fetch(base + "matchmaking", {
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(ticket ? { Authorization: `Bearer ${ticket}` } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    const first = (await request("POST", { clientId: a, profile: alice })).body;
    expect((await request("GET", undefined, first.ticket)).body).toEqual({
      status: "waiting",
    });
    expect(
      (await request("POST", { clientId: a, profile: alice })).body.ticket,
    ).toBe(first.ticket);
    const second = (await request("POST", { clientId: b, profile: bob })).body;
    const [one, two] = await Promise.all([
      request("GET", undefined, first.ticket),
      request("GET", undefined, second.ticket),
    ]);
    expect(one.body.status).toBe("matched");
    expect(two.body.status).toBe("matched");
    expect(one.body.code).toBe(two.body.code);
    expect([one.body.seat, two.body.seat]).toEqual([0, 1]);
    expect(one.body.token).not.toBe(two.body.token);
    const room = app.manager.require(one.body.code);
    expect(app.manager.auth(room, one.body.token)).toBe(0);
    expect(app.manager.auth(room, two.body.token)).toBe(1);
    expect(room.data.profiles[0].color).not.toBe(room.data.profiles[1]!.color);
    expect((await request("GET", undefined, "fake")).status).toBe(401);
    expect((await request("DELETE", undefined, first.ticket)).body.status).toBe(
      "matched",
    );
    const third = (await request("POST", { clientId: c, profile: alice })).body;
    expect((await request("DELETE", undefined, third.ticket)).body.status).toBe(
      "cancelled",
    );
    expect((await request("GET", undefined, third.ticket)).status).toBe(401);
  });

  it("expires idle entries and never pairs a client with its own retry", async () => {
    app = createApp({ data: ":memory:" });
    await app.listen(0);
    const queue = new Matchmaking(app.manager);
    const first = queue.start(a, alice, 100);
    expect(queue.start(a, alice, 101)).toEqual(first);
    queue.expire(25_101);
    expect(() => queue.status(first.ticket, 25_101)).toThrow("BAD_TOKEN");
    const other = queue.start(b, bob, 25_102);
    expect(queue.status(other.ticket, 25_103).status).toBe("waiting");
  });
});
