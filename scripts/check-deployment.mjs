// Creates one temporary room on the explicitly selected deployment, runs two
// browsers through a complete game, and deletes only that test room in finally.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const url = process.env.DUO_SMOKE_URL;
if (!url || !/^https:\/\//.test(url) || !url.endsWith("/")) {
  throw new Error("Set DUO_SMOKE_URL to the HTTPS deployment URL ending in /.");
}
const origin = new URL(url).origin;
const evidence = process.env.DUO_SMOKE_DIR || "docs/evidence";
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});
let credentials;
let hostPage;
const errors = [];
let sockets = 0;
try {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const one = await a.newPage(),
    two = await b.newPage();
  hostPage = one;
  for (const page of [one, two]) {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("websocket", (socket) => {
      expect(socket.url()).toBe(url.replace("https:", "wss:") + "ws");
      sockets++;
    });
  }
  const response = await one.goto(url);
  expect(response.status()).toBe(200);
  expect(await one.evaluate(() => isSecureContext)).toBe(true);
  const fonts = await one.evaluate(async () => {
    const chinese = await document.fonts.load('16px "DuoDisplay"', "二人世界");
    const latin = await document.fonts.load('16px "DuoLatin"', "Duo123");
    return (
      chinese.length > 0 &&
      latin.length > 0 &&
      [...chinese, ...latin].every((font) => font.status === "loaded")
    );
  });
  expect(fonts).toBe(true);
  console.log("PASS: both bundled fonts loaded successfully");
  await one.screenshot({
    path: join(evidence, "deployed-home-mobile.png"),
    fullPage: true,
  });
  await one.getByRole("button", { name: /创建房间，邀请/ }).click();
  await one.getByLabel("你的昵称").fill("部署验收甲");
  const created = one.waitForResponse(
    (r) => r.url() === url + "api/rooms" && r.request().method() === "POST",
  );
  await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
  const createResponse = await created;
  expect(createResponse.status()).toBe(201);
  await expect(one.getByText("等 TA 加入…")).toBeVisible();
  credentials = await one.evaluate(
    (prefix) => {
      const code = localStorage.getItem(prefix + "lastRoom");
      return { code, token: localStorage.getItem(prefix + "token." + code) };
    },
    new URL(url).pathname === "/duo-preview/" ? "duo.preview." : "duo.",
  );
  expect(credentials.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  expect(credentials.token).toBeTruthy();
  await two.goto(one.url());
  await two.getByLabel("你的昵称").fill("部署验收乙");
  await two.getByRole("button", { name: "进入房间 ❤" }).click();
  await expect(one.locator(".couple-names")).toContainText("部署验收乙");
  console.log(
    "PASS: trusted HTTPS, assets, room creation/join and WSS on two clients",
  );
  await one.getByRole("button", { name: "了解深夜聊天卡" }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await one.getByRole("button", { name: "我准备好了" }).click();
  await two.getByRole("button", { name: "我准备好了" }).click();
  await expect(one.getByTestId("talk-card")).toBeEnabled({ timeout: 15000 });
  await one.getByTestId("talk-card").click();
  await expect(one.getByTestId("card-question")).toBeVisible();
  const question = await one.getByTestId("card-question").textContent();
  await expect(two.getByTestId("card-question")).toHaveText(question);
  await two.reload();
  await expect(two.getByTestId("card-question")).toHaveText(question);
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 15000 });
  await one.getByRole("button", { name: "☆ 收藏", exact: true }).click();
  await expect(one.getByRole("button", { name: "★ 已收藏" })).toBeVisible();
  await one.getByRole("button", { name: "✎ 写下来" }).click();
  await one.getByRole("textbox", { name: "你的回答" }).fill("线上部署验收记录");
  await one.getByRole("button", { name: "存进我们的问答本" }).click();
  await expect(
    one.getByRole("dialog", { name: "把这一刻写下来" }),
  ).toBeHidden();
  const journal = await fetch(
    url + "api/rooms/" + credentials.code + "/journal",
    {
      headers: { Authorization: "Bearer " + credentials.token, Origin: origin },
    },
  );
  expect(journal.status).toBe(200);
  expect((await journal.json()).total).toBe(1);
  await one.screenshot({
    path: join(evidence, "deployed-game-mobile.png"),
    fullPage: true,
  });
  console.log(
    "PASS: synchronized card, reload/reconnect, favorite and saved answer",
  );
  for (let index = 0; index < 10; index++) {
    if (index > 0) {
      await (index % 2 === 0 ? one : two).getByTestId("talk-card").click();
      await expect(one.getByTestId("card-question")).toBeVisible();
      await expect(two.getByTestId("card-question")).toHaveText(
        await one.getByTestId("card-question").textContent(),
      );
    }
    await one.getByRole("button", { name: "聊好了，下一张 →" }).click();
    await expect(
      two.locator(index === 9 ? ".result-page h1" : ".turn-label"),
    ).toContainText(index === 9 ? "10 张" : "第 " + (index + 2) + " 张");
  }
  await expect(one.locator(".result-page h1")).toHaveText("10 张");
  await one.getByRole("button", { name: "保存图片 ↗" }).click();
  await expect(
    one.getByRole("img", { name: "本局聊天纪念卡，不含房间码" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      one
        .getByRole("img", { name: "本局聊天纪念卡，不含房间码" })
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await one.getByRole("button", { name: "换个游戏", exact: true }).click();
  for (const page of [one, two])
    await page.evaluate(() => localStorage.setItem("duo.inputOffset", "0"));
  for (const [id, name, selector] of [
    ["draw-guess", "你画我猜", ".drawing-stage"],
    ["mind-meld", "心有灵犀", ".mind-stage"],
    ["know-me", "你懂我吗", ".know-stage"],
    ["gomoku", "爱心五子棋", ".gomoku-stage"],
    ["red-thread", "一线牵", ".red-game canvas"],
    ["my-eyes", "你是我的眼", ".maze-board"],
    ["heart-bounce", "颠颠爱心", ".bounce-game canvas"],
    ["puzzle-us", "拼出我们", ".puzzle-game canvas"],
    ["heartbeat", "心跳节拍", ".rhythm-field canvas"],
  ]) {
    await one.getByRole("button", { name: "了解" + name, exact: true }).click();
    await one
      .getByRole("button", { name: "一起玩这个 ❤", exact: true })
      .click();
    await two.getByRole("button", { name: "好呀", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.locator(selector)).toBeVisible({ timeout: 15000 });
    await expect(two.locator(selector)).toBeVisible({ timeout: 15000 });
    await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 15000 });
    if (id === "red-thread") await one.keyboard.press("Space");
    if (id === "puzzle-us") {
      await one.getByRole("button", { name: "看原图", exact: true }).click();
      await expect(one.locator(".puzzle-preview")).toBeVisible();
    }
    await one.screenshot({
      path: join(evidence, "deployed-" + id + ".png"),
      fullPage: true,
    });
    await one.getByRole("button", { name: "退出本局", exact: true }).click();
    await one.getByRole("button", { name: "结束本局", exact: true }).click();
    await expect(two.locator(".result-page")).toBeVisible();
    await one.getByRole("button", { name: "换个游戏", exact: true }).click();
    console.log(
      "PASS deployed two-seat lazy game, controls, and result: " + id,
    );
  }
  const uploaded = await one.evaluate(
    async ({ url, credentials }) => {
      const c = document.createElement("canvas");
      c.width = c.height = 500;
      const ctx = c.getContext("2d");
      const pixels = ctx.createImageData(500, 500);
      let seed = 42;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels.data[i] = seed & 255;
        pixels.data[i + 1] = (seed >>> 8) & 255;
        pixels.data[i + 2] = (seed >>> 16) & 255;
        pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      const blob = await new Promise((resolve) =>
        c.toBlob(resolve, "image/png"),
      );
      const response = await fetch(
        url + "api/rooms/" + credentials.code + "/images",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + credentials.token,
            "Content-Type": "image/png",
          },
          body: blob,
        },
      );
      return { status: response.status, size: blob.size };
    },
    { url, credentials },
  );
  expect(uploaded.size).toBeGreaterThan(16384);
  expect(uploaded.status).toBe(201);
  console.log(
    "PASS authenticated image upload through HTTPS reverse proxy (>16KiB)",
  );
  expect(sockets).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
  console.log(
    "PASS: complete 10-card game, both results and share image; no JS/CSP errors",
  );
} finally {
  if (!credentials && hostPage && !hostPage.isClosed()) {
    credentials = await hostPage
      .evaluate(() => {
        const prefix = location.pathname.startsWith("/duo-preview/") ? "duo.preview." : "duo.";
        const code = localStorage.getItem(prefix + "lastRoom");
        return { code, token: localStorage.getItem(prefix + "token." + code) };
      })
      .catch(() => undefined);
  }
  await browser.close();
  if (credentials?.code && credentials?.token) {
    const response = await fetch(url + "api/rooms/" + credentials.code, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + credentials.token, Origin: origin },
    });
    if (!response.ok)
      throw new Error("Could not remove deployment smoke-test room");
    console.log("PASS: temporary deployment test room removed");
  }
}
