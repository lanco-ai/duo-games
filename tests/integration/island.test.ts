import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/index";
import {
  generateKeys,
  Pusher,
  type PushMessage,
  type Subscription,
} from "../../server/push";
import { HOUR } from "../../shared/island/rules";

class Spy extends Pusher {
  sent: { endpoint: string; message: PushMessage }[] = [];
  async send(sub: Subscription, message: PushMessage) {
    this.sent.push({ endpoint: sub.endpoint, message });
    return "ok" as const;
  }
}
let app: ReturnType<typeof createApp> | undefined;
const dirs: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  if (app) await app.close();
  app = undefined;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
async function boot(data: string, pusher: Pusher) {
  app = createApp({ data, pusher });
  const port = await app.listen(0),
    base = `http://127.0.0.1:${port}/api/`;
  return async (path: string, body?: object, token?: string) => {
    const res = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
}

describe("island api", () => {
  it("grows, waters, ships and keeps everything across a restart", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.UTC(2026, 10, 20, 0, 0);
    vi.setSystemTime(start);
    const dir = mkdtempSync(join(tmpdir(), "island-")),
      data = join(dir, "duo.db");
    dirs.push(dir);
    const keys = generateKeys("https://example.com/");
    let spy = new Spy(keys);
    let call = await boot(data, spy);
    const host = (
      await call("rooms", {
        profile: { nickname: "小满", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    const guest = (
      await call(`rooms/${host.code}/join`, {
        profile: { nickname: "阿南", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
    await call(
      `rooms/${host.code}/push`,
      {
        endpoint: "https://web.push.apple.com/host",
        keys: {
          p256dh: generateKeys("mailto:a@example.com").publicKey,
          auth: "BTBZMqHH6r4Tts7J_aSIgg",
        },
      },
      host.token,
    );
    const island = (token: string, body?: object) =>
      call(`rooms/${host.code}/island`, body, token);

    expect((await call(`rooms/${host.code}/island`)).status).toBe(401);
    let r = await island(host.token);
    expect(r.body.island.level).toBe(1);
    expect(r.body.now).toBe(start);

    await island(host.token, { cmd: "plant", plot: 0, crop: "stoneflower" });
    expect(
      (await island(host.token, { cmd: "plant", plot: 1, crop: "coralbud" }))
        .status,
    ).toBe(400);

    // 对方浇水：剩余时间减半，提醒种地的人
    vi.setSystemTime(start + 4 * HOUR);
    r = await island(guest.token, { cmd: "water", plot: 0 });
    expect(r.status).toBe(200);
    expect(r.body.island.plots[0][0].readyAt).toBe(start + 14 * HOUR);
    expect(spy.sent[0].message).toMatchObject({
      title: "半途岛",
      body: "阿南帮你的石花浇了水",
      url: `r/${host.code}#island`,
    });

    // 重启后照常收获
    await app!.close();
    spy = new Spy(keys);
    call = await boot(data, spy);
    vi.setSystemTime(start + 14 * HOUR);
    r = await island(host.token, { cmd: "harvest", plot: 0 });
    expect(r.body.island.bags[0]).toEqual({ stoneflower: 2 });
    expect(r.body.version).toBe(3);
  });
});
