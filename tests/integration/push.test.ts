import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/index";
import { generateKeys, Pusher } from "../../server/push";
let app: ReturnType<typeof createApp> | undefined;
afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe("push subscriptions", () => {
  it("stores a seat's subscription, sends to it and forgets it on transfer", async () => {
    const delivered: string[] = [];
    let status = 201;
    const pusher = new Pusher(generateKeys("https://example.com/"), (async (
      url: string,
    ) => {
      delivered.push(url);
      return new Response(null, { status });
    }) as typeof fetch);
    app = createApp({ data: ":memory:", pusher });
    const port = await app.listen(0),
      base = `http://127.0.0.1:${port}/api/`;
    const call = async (
      path: string,
      method = "GET",
      body?: object,
      token?: string,
    ) => {
      const res = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body && JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as any };
    };
    expect((await call("push/key")).body.key).toBe(pusher.keys.publicKey);
    const host = (
      await call("rooms", "POST", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    const guest = (
      await call(`rooms/${host.code}/join`, "POST", {
        profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
    const sub = (endpoint: string) => ({
      endpoint,
      keys: {
        p256dh: generateKeys("mailto:a@example.com").publicKey,
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
    });
    const push = `rooms/${host.code}/push`;
    expect(
      (await call(push, "POST", sub("https://web.push.apple.com/a"))).status,
    ).toBe(401);
    expect(
      (await call(push, "POST", sub("https://example.com/a"), host.token))
        .status,
    ).toBe(400);
    expect(
      (
        await call(
          push,
          "POST",
          sub("https://web.push.apple.com/a"),
          host.token,
        )
      ).status,
    ).toBe(200);
    await call(push, "POST", sub("https://web.push.apple.com/b"), guest.token);

    // 测试推送只发给自己的设备
    expect(
      (await call(push + "/test", "POST", undefined, host.token)).body,
    ).toEqual({ sent: 1 });
    expect(delivered).toEqual(["https://web.push.apple.com/a"]);
    expect(
      await app.notify(host.code, 1, { title: "t", body: "b", url: "/" }),
    ).toBe(1);

    // 订阅失效（410）后自动删除
    status = 410;
    expect(
      await app.notify(host.code, 1, { title: "t", body: "b", url: "/" }),
    ).toBe(0);
    status = 201;
    delivered.length = 0;
    expect(
      await app.notify(host.code, 1, { title: "t", body: "b", url: "/" }),
    ).toBe(0);
    expect(delivered).toEqual([]);

    // 换设备后旧设备的订阅作废
    const link = (
      await call(
        `rooms/${host.code}/rebind-link`,
        "POST",
        undefined,
        host.token,
      )
    ).body;
    await call(`rooms/${host.code}/rebind`, "POST", { secret: link.secret });
    expect(
      await app.notify(host.code, 0, { title: "t", body: "b", url: "/" }),
    ).toBe(0);

    // 测试推送限流：连发 3 条之后要等一会儿
    for (let i = 0; i < 3; i++)
      expect(
        (await call(push + "/test", "POST", undefined, guest.token)).status,
      ).toBe(200);
    expect(
      (await call(push + "/test", "POST", undefined, guest.token)).status,
    ).toBe(429);
  });

  it("reports no key when push is not configured", async () => {
    app = createApp({ data: ":memory:", pusher: null });
    const port = await app.listen(0);
    const res = await fetch(`http://127.0.0.1:${port}/api/push/key`);
    expect(await res.json()).toEqual({ key: null });
  });
});
