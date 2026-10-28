import { test, expect, type Page, type BrowserContext } from "@playwright/test";
async function instrument(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as any,
      Original = WebSocket;
    w.observed = { room: null, game: null, acks: {}, events: [] };
    const parts = new Map();
    w.WebSocket = class extends Original {
      constructor(...args: any[]) {
        super(args[0], args[1]);
        w.gameSocket = this;
        this.addEventListener("message", (e) => {
          let m = JSON.parse(String(e.data));
          if (m.t === "part") {
            let p = parts.get(m.id);
            if (!p) {
              p = [];
              parts.set(m.id, p);
            }
            p[m.index] = m.text;
            if (p.filter(Boolean).length !== m.total) return;
            m = JSON.parse(p.join(""));
          }
          if (m.t === "welcome") {
            w.observed.room = m.room;
            w.observed.game = m.game;
          }
          if (m.t === "room") w.observed.room = m.room;
          if (m.t === "game") w.observed.game = m.view;
          if (m.t === "ack") w.observed.acks[m.aid] = m;
          if (m.t === "extra") {
            w.observed.events.push(m.event);
            if (w.observed.events.length > 100) w.observed.events.shift();
          }
        });
      }
    };
    try {
      localStorage.setItem("duo.inputOffset", "0");
    } catch {}
  });
}
async function act(page: Page, a: any) {
  const aid = await page.evaluate((a) => {
    const w = window as any,
      aid = crypto.randomUUID();
    w.gameSocket.send(
      JSON.stringify({ t: "act", aid, seq: w.observed.room.seq, a }),
    );
    return aid;
  }, a);
  await page.waitForFunction((id) => (window as any).observed.acks[id], aid);
  const ack = await page.evaluate(
    (id) => (window as any).observed.acks[id],
    aid,
  );
  expect(
    ack.ok,
    JSON.stringify({
      ack,
      a,
      state: await page.evaluate(() => ({
        phase: (window as any).observed.room?.phase,
        game: (window as any).observed.game?.kind,
        round: (window as any).observed.game?.data.round,
        lastMove: (window as any).observed.game?.data.lastMove,
      })),
    }),
  ).toBe(true);
}
const data = (p: Page) => p.evaluate(() => (window as any).observed.game?.data);
async function game(p: Page, command: string, payload: any = {}) {
  const run = await p.evaluate(() => (window as any).observed.game.run);
  await act(p, { type: "game", run, command, payload });
}
async function start(
  one: Page,
  two: Page,
  id: string,
  name: string,
  options?: any,
) {
  await one.getByRole("button", { name: "了解" + name, exact: true }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤", exact: true }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await expect(
    one.getByRole("button", { name: "我准备好了", exact: true }),
  ).toBeVisible();
  if (options) {
    const settings = await one.evaluate(
      () => (window as any).observed.room.settings,
    );
    await act(one, {
      type: "settings",
      settings: { ...settings, games: { ...settings.games, [id]: options } },
    });
  }
  if (id === "puzzle-us") {
    const encoded = await one.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 160;
      const x = c.getContext("2d")!;
      x.fillStyle = "#dd8899";
      x.fillRect(0, 0, 256, 160);
      x.fillStyle = "#8abfa2";
      x.fillRect(100, 40, 120, 80);
      return c.toDataURL("image/png").split(",")[1];
    });
    await one.getByLabel("上传拼图照片").setInputFiles({
      name: "our-test-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(encoded, "base64"),
    });
    await expect(one.locator(".upload-photo")).toContainText("已选择合照");
  }
  if (id === "heartbeat") {
    for (const page of [one, two]) {
      await page.getByRole("button", { name: /已校准 · 再校准一次/ }).click();
      for (let i = 0; i < 8; i++) {
        await expect(page.locator(".calibration-pad")).toHaveClass(
          "calibration-pad pulse-" + ((i + 1) % 2),
          { timeout: 3000 },
        );
        await page.locator(".calibration-pad").click();
      }
      expect(
        Math.abs(
          Number(
            await page.evaluate(() => localStorage.getItem("duo.inputOffset")),
          ),
        ),
      ).toBeLessThanOrEqual(200);
    }
  }
  await one.getByRole("button", { name: "我准备好了", exact: true }).click();
  await two.getByRole("button", { name: "我准备好了", exact: true }).click();
  await one.waitForFunction(
    () => (window as any).observed.room.phase === "playing",
  );
  await two.waitForFunction(
    () => (window as any).observed.room.phase === "playing",
  );
  // The instrumented socket observes messages before the client's artificial
  // delay. Wait for the rendered countdown to disappear after both start.
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
  await expect(two.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
}
async function result(one: Page, two: Page) {
  await expect(one.locator(".result-page")).toBeVisible({ timeout: 100000 });
  await expect(two.locator(".result-page")).toBeVisible();
  await one.getByRole("button", { name: "再来一局", exact: true }).click();
  await two.getByRole("button", { name: "再来一局", exact: true }).click();
  await expect(
    one.getByRole("button", { name: "我准备好了", exact: true }),
  ).toBeVisible();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(one.locator(".game-grid")).toBeVisible();
}
function route(m: any) {
  const queue = [m.pos],
    prev = new Map([[m.pos, -1]]);
  for (let i = 0; i < queue.length; i++)
    for (const delta of [-m.w, 1, m.w, -1]) {
      const n = queue[i] + delta;
      if (
        n >= 0 &&
        n < m.grid.length &&
        !m.grid[n] &&
        !m.traps.includes(n) &&
        !prev.has(n)
      ) {
        prev.set(n, queue[i]);
        queue.push(n);
      }
    }
  const path: number[] = [];
  for (let n = m.exit; n !== -1; n = prev.get(n) ?? -1) path.unshift(n);
  return path;
}
test("mind-meld — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "mind-meld", "心有灵犀");
    await one.getByLabel("你的联想词").fill("咖啡");
    await one.getByRole("button", { name: "写好了，一起揭晓" }).click();
    await expect(two.getByLabel("你的联想词")).toBeEnabled();
    expect(await two.locator(".mind-stage").textContent()).not.toContain(
      "咖啡",
    );
    await two.getByLabel("你的联想词").fill("咖啡");
    await two.getByRole("button", { name: "写好了，一起揭晓" }).click();
    await result(one, two);
    await one.getByRole("button", { name: /画廊/ }).click();
    await expect(one.locator(".gallery-list button")).toHaveCount(1);
    await one.locator(".gallery-list button").first().click();
    await one.getByRole("button", { name: "保存图片", exact: true }).click();
    await expect(one.getByAltText("长按保存作品")).toBeVisible();
    await one.getByRole("button", { name: "关闭", exact: true }).click();
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("gomoku — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "gomoku", "爱心五子棋", {
      first: "房主",
      seconds: 0,
      wager: "请喝奶茶",
    });
    await one.locator('[data-cell="112"]').click();
    await expect(two.locator('[data-cell="112"]')).toContainText("♥");
    await one.getByRole("button", { name: "悔一步", exact: true }).click();
    await two.getByRole("button", { name: "让 TA ❤", exact: true }).click();
    await expect(one.locator('[data-cell="112"]')).not.toContainText("♥");
    await one.getByRole("button", { name: "认输", exact: true }).click();
    await one.getByRole("button", { name: "确认认输", exact: true }).click();
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("draw-guess — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "draw-guess", "你画我猜", {
      rounds: 4,
      seconds: 60,
      libraries: ["日常"],
    });
    // Public IP over HTTP is not a secure context and has no randomUUID.
    await Promise.all(
      [one, two].map((page) =>
        page.evaluate(() => {
          Object.defineProperty(crypto, "randomUUID", {
            value: undefined,
            configurable: true,
          });
        }),
      ),
    );
    for (let round = 0; round < 4; round++) {
      const drawer = round % 2 ? two : one,
        guesser = round % 2 ? one : two;
      await expect(drawer.locator(".word-choices .choice")).toHaveCount(3);
      await drawer.locator(".word-choices .choice").first().click();
      await expect(drawer.locator(".drawing-canvas")).toBeVisible();
      const box = await drawer.locator(".drawing-canvas").evaluate((canvas) => {
        const r = canvas.getBoundingClientRect();
        return {
          x: r.left + canvas.clientLeft,
          y: r.top + canvas.clientTop,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        };
      });
      await drawer.mouse.move(
        box.x + box.width * 0.05,
        box.y + box.height * 0.25,
      );
      await drawer.mouse.down();
      await drawer.mouse.move(box.x + box.width - 50, box.y + box.height - 60, {
        steps: 12,
      });
      await drawer.mouse.up();
      await expect
        .poll(async () => {
          const first = await guesser.evaluate(
            (r) =>
              (window as any).observed.events
                .find(
                  (e: any) =>
                    e.kind === "ink" &&
                    e.data.round === r &&
                    e.data.op === "points" &&
                    e.data.offset === 0,
                )
                ?.data.points.slice(0, 2),
            round,
          );
          return (
            first &&
            Math.abs(first[0] - 50) <= 2 &&
            Math.abs(first[1] - 250) <= 2
          );
        })
        .toBe(true);
      if (round === 0) {
        await guesser.reload();
        await expect(guesser.locator(".drawing-canvas")).toBeVisible();
        await expect(guesser.locator(".game-overlay")).toBeHidden({
          timeout: 20000,
        });
        await drawer.screenshot({
          path: "test-results/all-drawing.png",
          fullPage: true,
        });
      }
      const answer = (await data(drawer)).answer;
      expect((await data(guesser)).answer).toBeNull();
      await guesser.getByLabel("猜一个词").fill(answer);
      await guesser
        .getByRole("button", { name: "猜一猜", exact: true })
        .click();
    }
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("know-me — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "know-me", "你懂我吗", {
      count: 10,
      categories: ["吃喝", "习惯", "回忆", "恋爱观", "假如", "未来"],
      unused: false,
    });
    for (let idx = 0; idx < 10; idx++) {
      await one.waitForFunction(
        (i) => (window as any).observed.game.data.idx === i,
        idx,
      );
      const d = await data(one),
        answer =
          d.question.type === "choice"
            ? 0
            : d.question.type === "slider"
              ? 55
              : d.question.type === "rank"
                ? [0, 1, 2, 3]
                : "一起散步";
      await game(one, "submit", { idx, answer });
      await game(two, "submit", { idx, answer });
      await one.waitForFunction(
        () => (window as any).observed.game.data.phase !== "answer",
      );
      if (d.question.type === "text")
        await game(idx % 2 ? two : one, "grade", { idx, score: 10 });
      await expect(
        one.getByRole("button", {
          name: idx === 9 ? "看看默契指数" : "下一题 →",
          exact: true,
        }),
      ).toBeVisible();
      await one
        .getByRole("button", {
          name: idx === 9 ? "看看默契指数" : "下一题 →",
          exact: true,
        })
        .click();
    }
    await expect(one.locator(".result-page h1")).toHaveText("100%");
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("my-eyes — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  // Emulate CSS parsing on browsers predating the small-viewport units.
  for (const context of [a, b]) {
    await context.route("**/*.css", async (route) => {
      const response = await route.fetch();
      // An unknown unit preserves var()'s computed-value validation behavior.
      const css = (await response.text()).replaceAll("svh", "duoUnsupportedVh");
      await route.fulfill({ response, body: css });
    });
  }
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "my-eyes", "你是我的眼");
    for (const page of [one, two]) {
      const bounds = await page.locator(".maze-board").boundingBox();
      expect(bounds!.width).toBeGreaterThan(200);
      expect(bounds!.height).toBeGreaterThan(200);
    }
    for (let round = 0; round < 6; round++) {
      const walker = round % 2 ? two : one,
        guide = round % 2 ? one : two;
      const m = await data(guide);
      expect((await data(walker)).grid).toBeUndefined();
      const path = route(m);
      let last = m.pos;
      for (const [n, cell] of path.slice(1).entries()) {
        const delta = cell - last,
          dir = delta === 1 ? 1 : delta === -1 ? 3 : delta === m.w ? 2 : 0;
        // Raw socket test actions bypass the UI's input pacing. Stay below the
        // production per-seat 20/s limit instead of relaxing that protection.
        await walker.waitForTimeout(60);
        await game(walker, "move", { round, n, dir });
        last = cell;
      }
      await expect(
        walker.getByRole("button", {
          name: round === 5 ? "看看我们的星星" : "交换身份，下一关 →",
        }),
      ).toBeVisible();
      await walker
        .getByRole("button", {
          name: round === 5 ? "看看我们的星星" : "交换身份，下一关 →",
        })
        .click();
      if (round < 5) {
        await one.waitForFunction(
          (r) => (window as any).observed.game.data.round === r,
          round + 1,
        );
        await two.waitForFunction(
          (r) => (window as any).observed.game.data.round === r,
          round + 1,
        );
      }
    }
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("puzzle-us — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "puzzle-us", "拼出我们", {
      pieces: 24,
      image: "scene:sakura",
    });
    await expect(one.getByLabel("双人拼图桌面")).toBeVisible();
    await one.getByLabel("双人拼图桌面").scrollIntoViewIfNeeded();
    const d0 = await data(one),
      piece = d0.groups.at(-1),
      scale = Math.min(
        720 / (d0.width + d0.pw * 6),
        500 / (d0.height + d0.ph * 5),
      ),
      rect = await one.getByLabel("双人拼图桌面").evaluate((canvas) => {
        const r = canvas.getBoundingClientRect();
        return {
          x: r.left + canvas.clientLeft,
          y: r.top + canvas.clientTop,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        };
      }),
      px = ((piece.pieces[0] % d0.cols) + 0.5) * d0.pw + piece.x,
      py = (Math.floor(piece.pieces[0] / d0.cols) + 0.5) * d0.ph + piece.y,
      screen = {
        x:
          rect.x +
          (((720 - d0.width * scale) / 2 + px * scale) / 720) * rect.width,
        y:
          rect.y +
          (((500 - d0.height * scale) / 2 + py * scale) / 500) * rect.height,
      };
    await one.mouse.move(screen.x, screen.y);
    await one.mouse.down();
    await one.waitForFunction(
      (id) =>
        (window as any).observed.game.data.groups.find((g: any) => g.id === id)
          ?.lockedBy === 0,
      piece.id,
      { timeout: 15000 },
    );
    await one.mouse.move(screen.x + 30, screen.y + 20, { steps: 5 });
    await one.mouse.up();
    await one.waitForFunction(
      (id) =>
        (window as any).observed.game.data.groups.find((g: any) => g.id === id)
          ?.lockedBy === null,
      piece.id,
      { timeout: 15000 },
    );
    await one.getByRole("button", { name: "看原图", exact: true }).click();
    await expect(one.locator(".puzzle-preview")).toBeVisible();
    let rounds = 0;
    while (rounds++ < 24) {
      const d = await data(one),
        g = d.groups.find((x: any) => !x.placed);
      if (!g) break;
      // Allow the server's action bucket to refill between the two-action moves.
      await one.waitForTimeout(120);
      await game(one, "grab", { gid: g.id });
      await game(one, "drop", { gid: g.id, x: 0, y: 0 });
      if (rounds === 1)
        await one.screenshot({
          path: "test-results/all-puzzle.png",
          fullPage: true,
        });
      if (await one.locator(".result-page").isVisible()) break;
    }
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("red-thread — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "red-thread", "一线牵", { level: "endless" });
    await expect(one.getByLabel("一线牵攀登画面")).toBeVisible();
    const lastInput = () =>
      one.evaluate(async () => {
        const w = window as any,
          code = w.observed.room.code;
        const r = await fetch(
          "/api/rooms/" +
            code +
            "/game-data?run=" +
            w.observed.game.run +
            "&kind=replay",
          {
            headers: {
              Authorization:
                "Bearer " + localStorage.getItem("duo.token." + code),
            },
          },
        );
        return (await r.json()).frames[0].at(-1)?.[1];
      });
    await one.keyboard.down("ArrowRight");
    await one.keyboard.down("d");
    await one.keyboard.up("d");
    await expect.poll(lastInput).toBe(2);
    await one.keyboard.up("ArrowRight");
    await expect.poll(lastInput).toBe(0);
    await one.keyboard.down("ArrowRight");
    await expect.poll(lastInput).toBe(2);
    await one.getByRole("button", { name: "💬 聊天", exact: true }).click();
    await one.getByLabel("聊天内容", { exact: true }).focus();
    await one.keyboard.up("ArrowRight");
    await expect.poll(lastInput).toBe(0);
    await one.getByRole("button", { name: "关闭", exact: true }).click();

    await one.keyboard.down("ArrowRight");
    await two.keyboard.down("ArrowRight");
    await one.waitForTimeout(2500);
    await one.keyboard.up("ArrowRight");
    await two.keyboard.up("ArrowRight");
    await one.keyboard.press("Space");
    await one.waitForTimeout(1000);
    await one.screenshot({
      path: "test-results/all-climbing.png",
      fullPage: true,
    });
    expect(
      await one.evaluate(async () => {
        const w = window as any,
          code = w.observed.room.code;
        const r = await fetch(
          "/api/rooms/" +
            code +
            "/game-data?run=" +
            w.observed.game.run +
            "&kind=replay",
          {
            headers: {
              Authorization:
                "Bearer " + localStorage.getItem("duo.token." + code),
            },
          },
        );
        return (await r.json()).tick;
      }),
    ).toBeGreaterThan(30);
    await b.setOffline(true);
    await expect(one.locator(".game-overlay")).toBeVisible({ timeout: 20000 });
    await b.setOffline(false);
    await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 25000 });
    await one.getByRole("button", { name: "把这次的高度记下来" }).click();
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("heart-bounce — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "heart-bounce", "颠颠爱心");
    for (const page of [one, two]) {
      const box = (await page
        .getByLabel("颠爱心画面，左右拖动接球")
        .boundingBox())!;
      await page.mouse.move(box.x + 10, box.y + 100);
    }
    await expect(one.locator(".result-page")).toBeVisible({ timeout: 40000 });
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("heartbeat — two seats complete and rematch with 200ms delay", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=200&jitter=40&debug=1");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "heartbeat", "心跳节拍", { track: "meet" });
    await expect(one.getByLabel("心跳节拍双轨道")).toBeVisible();
    await one.keyboard.press("f");
    await two.keyboard.press("j");
    await one.screenshot({
      path: "test-results/all-heartbeat.png",
      fullPage: true,
    });
    await b.setOffline(true);
    await one.waitForTimeout(15000);
    await expect(one.locator(".game-overlay")).toBeHidden();
    await b.setOffline(false);
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("puck-sling — sling pucks through the gap with real drags and reach a result", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const sling = await import("../../shared/games/puck-sling/sim");
  const a = await browser.newContext({ viewport: { width: 360, height: 740 } }),
    b = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await instrument(a);
  await instrument(b);
  const one = await a.newPage(),
    two = await b.newPage(),
    errors: string[] = [];
  one.on("pageerror", (e) => errors.push(e.message));
  two.on("pageerror", (e) => errors.push(e.message));
  try {
    await one.goto("/?lag=120&jitter=30");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("游戏验收甲");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    await two.goto(one.url());
    await two.getByLabel("你的昵称").fill("游戏验收乙");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("游戏验收乙");
    await start(one, two, "puck-sling", "桌上弹射冰球", { minutes: 2 });
    const label = "弹射冰球球桌：按住自己半场的冰球往后拉，松手弹出";
    await expect(one.getByLabel(label)).toBeVisible();
    // Each seat slings the free puck nearest the gap, by dragging on its own (flipped) view.
    async function shoot(page: Page, seat: 0 | 1) {
      const d = await data(page),
        s = sling.advance(d.base, d.shots, d.base.tick + 2000),
        mid = (q: any) => Math.hypot(q.x / 256 - 180, q.y / 256 - sling.MID),
        id = s.pucks
          .map((_: any, i: number) => i)
          .filter((i: number) => sling.grabbable(s.pucks[i], seat))
          .sort((x: number, y: number) => mid(s.pucks[x]) - mid(s.pucks[y]))[0];
      if (id === undefined) return;
      const q = s.pucks[id],
        x = q.x / 256,
        y = q.y / 256,
        l = mid(q),
        pull = 80 / l,
        box = (await page.getByLabel(label).boundingBox())!,
        screen = (bx: number, by: number) =>
          seat
            ? [box.x + (1 - bx / 360) * box.width, box.y + (1 - by / 640) * box.height]
            : [box.x + (bx / 360) * box.width, box.y + (by / 640) * box.height];
      const [sx, sy] = screen(x, y),
        [ex, ey] = screen(x - (180 - x) * pull, y - (sling.MID - y) * pull);
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(ex, ey, { steps: 6 });
      await page.mouse.up();
    }
    let shots = 0;
    for (let i = 0; i < 30; i++) {
      if (await one.locator(".result-page").isVisible()) break;
      await shoot(one, 0);
      if (i === 2) await shoot(two, 1);
      if (i === 1 && process.env.SLING_SHOTS) {
        await one.waitForTimeout(500);
        await one.screenshot({ path: process.env.SLING_SHOTS + "/seat0.png" });
        await two.screenshot({ path: process.env.SLING_SHOTS + "/seat1.png" });
      }
      await one.waitForTimeout(2600);
      shots = (await data(one))?.fired?.[0] ?? shots;
    }
    expect(shots).toBeGreaterThan(3);
    await result(one, two);
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
