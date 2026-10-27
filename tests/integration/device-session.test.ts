import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/index";
let app: ReturnType<typeof createApp> | undefined;
afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe("device session recovery", () => {
  it("does not let a partner's device claim the other seat", async () => {
    app = createApp({ data: ":memory:" });
    const port = await app.listen(0),
      base = `http://127.0.0.1:${port}/api/`;
    const request = async (
      path: string,
      body: object,
      token?: string,
      cookie?: string,
    ) => {
      const res = await fetch(base + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      });
      return {
        status: res.status,
        body: (await res.json()) as any,
        cookie: res.headers.get("set-cookie")?.split(";")[0],
      };
    };
    const host = (
      await request("rooms", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    const guest = (
      await request(`rooms/${host.code}/join`, {
        profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
    const input = { code: host.code, slot: "primary" };
    const a = await request("device/bind", input, host.token);
    const b = await request("device/bind", input, guest.token);
    expect(a.cookie).not.toBe(b.cookie);
    expect(
      (
        await request(
          "device/recover",
          { ...input, slot: "local" },
          undefined,
          b.cookie,
        )
      ).status,
    ).toBe(401);
    const recovered = await request(
      "device/recover",
      input,
      undefined,
      b.cookie,
    );
    expect(recovered.body.seat).toBe(1);
    expect(app.manager.auth(app.manager.require(host.code), host.token)).toBe(
      0,
    );
  });
  it("requires a seat credential to bind and restores only the bound seats", async () => {
    app = createApp({ data: ":memory:" });
    const port = await app.listen(0),
      base = `http://127.0.0.1:${port}/api/`;
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token?: string,
      cookie?: string,
    ) {
      const res = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: res.status,
        body: (await res.json()) as any,
        cookie: res.headers.get("set-cookie"),
      };
    }
    const host = (
      await request("rooms", "POST", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    const guest = (
      await request(`rooms/${host.code}/join`, "POST", {
        profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
    const payload = { code: host.code, slot: "primary" };
    expect(
      (await request("device/bind", "POST", payload, "wrong")).status,
    ).toBe(401);
    const bound = await request("device/bind", "POST", payload, host.token);
    expect(bound.status).toBe(200);
    expect(bound.cookie).toContain("HttpOnly");
    expect(bound.cookie).toContain("SameSite=Lax");
    expect(bound.cookie).toContain("Path=/api/device");
    const cookie = bound.cookie!.split(";")[0];
    expect(
      (await request("device/last", "GET", undefined, undefined, cookie)).body
        .code,
    ).toBe(host.code);
    expect((await request("device/recover", "POST", payload)).status).toBe(401);
    expect(
      (
        await request(
          "device/recover",
          "POST",
          { ...payload, slot: "local" },
          undefined,
          cookie,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "device/bind",
          "POST",
          { ...payload, slot: "local" },
          host.token,
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "device/bind",
          "POST",
          { ...payload, slot: "local" },
          guest.token,
          cookie,
        )
      ).status,
    ).toBe(200);
    const first = await request(
      "device/recover",
      "POST",
      payload,
      undefined,
      cookie,
    );
    expect(first.body.seat).toBe(0);
    expect(first.body.token).not.toBe(host.token);
    const second = await request(
      "device/recover",
      "POST",
      { ...payload, slot: "local" },
      undefined,
      cookie,
    );
    expect(second.body.seat).toBe(1);
    expect(
      app.manager.auth(app.manager.require(host.code), first.body.token),
    ).toBe(0);
    expect(
      app.manager.auth(app.manager.require(host.code), second.body.token),
    ).toBe(1);
    const transfer = await request(
      `rooms/${host.code}/rebind-link`,
      "POST",
      undefined,
      first.body.token,
    );
    expect(
      (
        await request(`rooms/${host.code}/rebind`, "POST", {
          secret: transfer.body.secret,
        })
      ).status,
    ).toBe(200);
    expect(
      (await request("device/recover", "POST", payload, undefined, cookie))
        .status,
    ).toBe(401);
  });
});
