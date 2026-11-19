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
import {
  boatTargets,
  hasTarget,
  netTargets,
  placeTargets,
  type Card,
  type TideState,
} from "../../shared/games/tide/rules";

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
// 用当前手牌找一步合法的出牌：能放就放，否则出浪，再不行就弃掉
function anyPlay(m: any, seat: 0 | 1) {
  const s = { board: m.board } as TideState;
  for (const card of m.hand)
    if (card === "lamp" || card === "coral" || card === "stone") {
      const at = placeTargets(s, seat, card)[0];
      if (at !== undefined) return { card, at };
    }
  if (m.hand.includes("wave")) return { card: "wave" };
  const card = m.hand.find((c: Card) => !hasTarget(s, seat, c));
  if (card) return { card };
  const at = netTargets(m.board, seat)[0];
  if (m.hand.includes("net") && at !== undefined) return { card: "net", at };
  const from = m.board.findIndex(
    (p: any, i: number) => p?.owner === seat && boatTargets(m.board, i).length,
  );
  return { card: "boat", at: from, to: boatTargets(m.board, from)[0] };
}

describe("async tide chess", () => {
  it("plays across a restart, reminds only the partner and supports live turns", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tide-")),
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
    const tokens = [host.token, guest.token] as const;
    const sub = (endpoint: string) => ({
      endpoint,
      keys: {
        p256dh: generateKeys("mailto:a@example.com").publicKey,
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
    });
    await call(
      `rooms/${host.code}/push`,
      sub("https://web.push.apple.com/host"),
      host.token,
    );
    await call(
      `rooms/${host.code}/push`,
      sub("https://web.push.apple.com/guest"),
      guest.token,
    );
    const tide = (seat: 0 | 1, body?: object) =>
      call(`rooms/${host.code}/tide`, body, tokens[seat]);

    expect((await tide(0)).body.match).toBeNull();
    let m = (await tide(0, { cmd: "new" })).body.match;
    expect(m.turn).toBe(0);
    expect(spy.sent.map((x) => x.endpoint)).toEqual([
      "https://web.push.apple.com/guest",
    ]);
    expect(spy.sent[0].message.body).toContain("小满开了一局");
    expect(spy.sent[0].message.url).toBe(`r/${host.code}#tide`);
    expect((await tide(1, { cmd: "new" })).status).toBe(400);

    // 先手出牌：对方收到提醒，看不到牌；可以收回再出
    spy.sent.length = 0;
    m = (await tide(0, { cmd: "play", turn: 0, ...anyPlay(m, 0) })).body.match;
    expect(m.picked).toEqual([true, false]);
    const theirs = (await tide(1)).body.match;
    expect(theirs.pick).toBeNull();
    expect(spy.sent.map((x) => x.endpoint)).toEqual([
      "https://web.push.apple.com/guest",
    ]);
    expect(spy.sent[0].message.body).toContain("小满出好牌了");
    m = (await tide(0, { cmd: "retract", turn: 0 })).body.match;
    expect(m.picked).toEqual([false, false]);
    m = (await tide(0, { cmd: "play", turn: 0, ...anyPlay(m, 0) })).body.match;

    // 后手出牌触发结算，只提醒先手
    spy.sent.length = 0;
    m = (await tide(1, { cmd: "play", turn: 0, ...anyPlay(theirs, 1) })).body
      .match;
    expect(m.turn).toBe(1);
    expect(spy.sent.map((x) => x.endpoint)).toEqual([
      "https://web.push.apple.com/host",
    ]);
    expect(spy.sent[0].message.body).toMatch(
      /第 1 回合揭晓.*轮到你出第 2 回合/,
    );

    // 对方正看着棋盘时不提醒
    await tide(1, { cmd: "watch", on: true });
    spy.sent.length = 0;
    m = (await tide(0)).body.match;
    await tide(0, { cmd: "play", turn: 1, ...anyPlay(m, 0) });
    expect(spy.sent).toEqual([]);

    // 重启服务器：对局还在，出过的牌也还在
    await app!.close();
    spy = new Spy(keys);
    call = await boot(data, spy);
    m = (await tide(0)).body.match;
    expect(m.turn).toBe(1);
    expect(m.picked).toEqual([true, false]);

    // 两人都在看时可以切到实时；超时按没出牌结算
    expect((await tide(0, { cmd: "live", on: true })).status).toBe(400);
    await tide(0, { cmd: "watch", on: true });
    await tide(1, { cmd: "watch", on: true });
    m = (await tide(0, { cmd: "live", on: true })).body.match;
    expect(m.deadline).toBeGreaterThan(Date.now());
    // 把时钟拨过 31 秒，期间两边照常发心跳
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(m.deadline + 1000);
    await tide(0, { cmd: "watch", on: true });
    await tide(1, { cmd: "watch", on: true });
    app!.tides.tick(Date.now());
    m = (await tide(1)).body.match;
    expect(m.turn).toBe(2);
    expect(m.last.outcomes[1]).toBe("timeout");
    expect(m.deadline).toBeGreaterThan(0);
    // 有人离开就退回异步
    await tide(1, { cmd: "watch", on: false });
    expect((await tide(0)).body.match.deadline).toBe(0);

    // 两人都离开棋盘，下完 12 回合
    await tide(0, { cmd: "watch", on: false });
    while (!(m = (await tide(0)).body.match).finished) {
      if (!m.picked[0])
        await tide(0, { cmd: "play", turn: m.turn, ...anyPlay(m, 0) });
      const other = (await tide(1)).body.match;
      if (!other.finished && !other.picked[1])
        await tide(1, { cmd: "play", turn: other.turn, ...anyPlay(other, 1) });
    }
    expect(m.turn).toBe(12);
    expect([-1, 0, 1]).toContain(m.winner);
    expect(spy.sent.at(-1)?.message.body).toMatch(/下完了/);
    expect((await tide(1, { cmd: "new" })).status).toBe(200);
  });

  it("lets either player end a stuck game", async () => {
    const spy = new Spy(generateKeys("https://example.com/"));
    const call = await boot(":memory:", spy);
    const host = (
      await call("rooms", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    await call(`rooms/${host.code}/join`, {
      profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
    });
    await call(`rooms/${host.code}/tide`, { cmd: "new" }, host.token);
    const m = (
      await call(`rooms/${host.code}/tide`, { cmd: "abandon" }, host.token)
    ).body.match;
    expect(m.finished).toBe(true);
    expect(m.ended).toBe("abandoned");
    expect(m.winner).toBeNull();
  });
});
