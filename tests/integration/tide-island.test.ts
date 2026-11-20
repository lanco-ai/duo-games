import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/index";
import {
  boatTargets,
  hasTarget,
  netTargets,
  placeTargets,
  type Card,
  type TideState,
} from "../../shared/games/tide/rules";
import { newIsland } from "../../shared/island/rules";

let app: ReturnType<typeof createApp> | undefined;
const dirs: string[] = [];
afterEach(async () => {
  if (app) await app.close();
  app = undefined;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
async function boot(data: string) {
  app = createApp({ data, pusher: null });
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

describe("潮汐棋 ↔ 半途岛", () => {
  it("brings island cards into the deck and pays rewards back to the island", async () => {
    const dir = mkdtempSync(join(tmpdir(), "link-")),
      data = join(dir, "duo.db");
    dirs.push(dir);
    let call = await boot(data);
    const host = (
      await call("rooms", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body;
    const guest = (
      await call(`rooms/${host.code}/join`, {
        profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
    const tokens = [host.token, guest.token] as const;
    const island = async () =>
      (await call(`rooms/${host.code}/island`, undefined, host.token)).body
        .island;
    // 甲在岛上做了 3 张灯牌，还有别的东西
    const s = newIsland(Date.now());
    s.bags[0] = { "card-lamp": 3, berry: 2 };
    app!.store.saveIsland(host.code, 1, s);

    const tide = (seat: 0 | 1, body?: object) =>
      call(`rooms/${host.code}/tide`, body, tokens[seat]);
    let m = (await tide(0, { cmd: "new" })).body.match;
    expect(m.brought).toBe(3);
    expect((await tide(1)).body.match.brought).toBe(0);
    expect((await island()).bags[0]).toEqual({ berry: 2 });

    // 下完 12 回合
    while (!(m = (await tide(0)).body.match).finished) {
      if (!m.picked[0])
        await tide(0, { cmd: "play", turn: m.turn, ...anyPlay(m, 0) });
      const other = (await tide(1)).body.match;
      if (!other.finished && !other.picked[1])
        await tide(1, { cmd: "play", turn: other.turn, ...anyPlay(other, 1) });
    }
    const theirs = (await tide(1)).body.match;
    const after = await island();
    for (const [seat, view] of [
      [0, m],
      [1, theirs],
    ] as const) {
      const won = view.winner === seat;
      if (won) {
        expect(view.reward).toEqual({ kind: "decor", decor: "flowerbed" });
        expect(after.decor[seat]).toEqual(["flowerbed"]);
      } else {
        expect(view.reward.kind).toBe("seeds");
        const got = Object.values(view.reward.items as object).reduce(
          (a: number, b: number) => a + b,
          0,
        );
        expect(got).toBe(3);
      }
    }
    // 重启后奖励还在
    await app!.close();
    call = await boot(data);
    const again = await island();
    expect(again.decor).toEqual(after.decor);
    expect((await tide(0)).body.match.reward).toEqual(m.reward);
  });

  it("gives no rewards when a game is ended early", async () => {
    const call = await boot(":memory:");
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
    expect(m.reward).toBeNull();
    const isl = (await call(`rooms/${host.code}/island`, undefined, host.token))
      .body.island;
    expect(isl.decor).toEqual([[], []]);
  });
});
