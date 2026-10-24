import { test, expect, type Page, type Browser } from "@playwright/test";
async function createPair(browser: Browser, query = "") {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const one = await a.newPage(),
    two = await b.newPage();
  await one.goto("/" + query);
  await one.getByRole("button", { name: /创建房间，邀请/ }).click();
  await one.getByLabel("你的昵称").fill("小鹿");
  await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
  await expect(one).toHaveURL(/\/r\//);
  await expect(one.getByText("等 TA 加入…")).toBeVisible();
  const url = one.url();
  await two.goto(url);
  await two.getByLabel("你的昵称").fill("阿北");
  await two.getByRole("button", { name: "进入房间 ❤" }).click();
  await expect(
    two.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  await expect(one.locator(".couple-names")).toContainText("阿北");
  return { a, b, one, two, url };
}
async function start(one: Page, two: Page) {
  await one.getByRole("button", { name: "了解深夜聊天卡" }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await expect(one.getByRole("button", { name: "我准备好了" })).toBeVisible();
  await one.getByRole("button", { name: "我准备好了" }).click();
  await two.getByRole("button", { name: "我准备好了" }).click();
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 15000 });
  await expect(one.getByTestId("talk-card")).toBeEnabled();
}
async function draw(page: Page) {
  await page.getByTestId("talk-card").click();
  await expect(page.getByTestId("card-question")).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("two-person flow, synced cards, answers, favorites, conflict, results and replay", async ({
  browser,
}) => {
  const { a, b, one, two } = await createPair(browser);
  const jsErrors: string[] = [];
  one.on("pageerror", (e) => jsErrors.push(e.message));
  two.on("pageerror", (e) => jsErrors.push(e.message));
  await one.screenshot({
    path: "docs/evidence/lobby-mobile.png",
    fullPage: true,
  });
  await start(one, two);
  await draw(one);
  const first = await one.getByTestId("card-question").textContent();
  await expect(two.getByTestId("card-question")).toHaveText(first!);
  await one.screenshot({
    path: "docs/evidence/talk-player-one.png",
    fullPage: true,
  });
  await two.screenshot({
    path: "docs/evidence/talk-player-two.png",
    fullPage: true,
  });
  await one.getByRole("button", { name: "☆ 收藏", exact: true }).click();
  await expect(one.getByRole("button", { name: "★ 已收藏" })).toBeVisible();
  await one.getByRole("button", { name: "✎ 写下来" }).click();
  await one
    .getByRole("textbox", { name: "你的回答" })
    .fill("我们开一家有猫的书店。");
  await two.getByRole("button", { name: "聊好了，下一张 →" }).click();
  await draw(two);
  await one.getByRole("button", { name: "存进我们的问答本" }).click();
  await expect(
    one.getByRole("dialog", { name: "把这一刻写下来" }),
  ).toBeHidden();
  const [nextOne, nextTwo] = await Promise.all([
    one.locator(".talk-next").elementHandle(),
    two.locator(".talk-next").elementHandle(),
  ]);
  await Promise.all([
    nextOne!.evaluate((el) => (el as HTMLButtonElement).click()),
    nextTwo!.evaluate((el) => (el as HTMLButtonElement).click()),
  ]);
  await expect(one.locator(".turn-label")).toContainText("第 3 张");
  await expect(two.locator(".turn-label")).toContainText("第 3 张");
  for (let idx = 2; idx < 9; idx++) {
    await draw(idx % 2 === 0 ? one : two);
    await one.getByRole("button", { name: "聊好了，下一张 →" }).click();
  }
  await draw(two);
  await one.getByRole("button", { name: "✎ 写下来" }).click();
  await one
    .getByRole("textbox", { name: "你的回答" })
    .fill("最后一张卡也要好好记住。");
  await two.getByRole("button", { name: "聊好了，下一张 →" }).click();
  await one.getByRole("button", { name: "存进我们的问答本" }).click();
  await expect(
    one.getByRole("dialog", { name: "把这一刻写下来" }),
  ).toBeHidden();
  await expect(one.locator(".result-page h1")).toHaveText("10 张");
  await expect(two.locator(".result-page h1")).toHaveText("10 张");
  await one.screenshot({
    path: "docs/evidence/result-mobile.png",
    fullPage: true,
  });
  await one.getByRole("button", { name: "📖 看看写下的回答" }).click();
  await expect(
    one.locator(".journal-entry").filter({ hasText: "我们开一家有猫的书店。" }),
  ).toContainText("我们开一家有猫的书店。");
  await expect(
    one
      .locator(".journal-entry")
      .filter({ hasText: "我们开一家有猫的书店。" })
      .locator("h3"),
  ).toHaveText(first!);
  await expect(
    one.getByText("最后一张卡也要好好记住。", { exact: true }),
  ).toBeVisible();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await one.getByRole("button", { name: "保存图片 ↗" }).click();
  await expect(
    one.getByRole("img", { name: "本局聊天纪念卡，不含房间码" }),
  ).toBeVisible();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await one.getByRole("button", { name: "再来一局", exact: true }).click();
  await expect(one.getByRole("button", { name: "等 TA 确认…" })).toBeVisible();
  await two.getByRole("button", { name: "再来一局", exact: true }).click();
  await expect(one.getByRole("button", { name: "我准备好了" })).toBeVisible();
  expect(jsErrors).toEqual([]);
  await a.close();
  await b.close();
});
test("300ms bidirectional delay with jitter: chat, full game, replay, refresh and takeover", async ({
  browser,
}) => {
  const { a, b, one, two, url } = await createPair(
    browser,
    "?lag=300&jitter=40&debug=1",
  );
  await start(one, two);
  await draw(one);
  const question = await one.getByTestId("card-question").textContent();
  await expect(two.getByTestId("card-question")).toHaveText(question!);
  await two.reload();
  await expect(two.getByTestId("card-question")).toHaveText(question!, {
    timeout: 20000,
  });
  await expect(two.locator(".game-overlay")).toBeHidden({ timeout: 18000 });
  await one.getByRole("button", { name: "💬 聊天" }).click();
  await one.getByRole("textbox", { name: "聊天内容" }).fill("<b>慢慢聊</b>");
  await one.getByRole("button", { name: "发送", exact: true }).click();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await two.getByRole("button", { name: "💬 聊天" }).click();
  await expect(two.locator(".chat-message p")).toHaveText("<b>慢慢聊</b>");
  expect(await two.locator(".chat-message b").count()).toBe(0);
  await two.getByRole("button", { name: "关闭", exact: true }).click();
  for (let idx = 0; idx < 10; idx++) {
    if (idx > 0) await draw(idx % 2 === 0 ? one : two);
    await one.getByRole("button", { name: "聊好了，下一张 →" }).click();
    await expect(
      two.locator(idx === 9 ? ".result-page h1" : ".turn-label"),
    ).toContainText(idx === 9 ? "10 张" : "第 " + (idx + 2) + " 张");
  }
  await one.getByRole("button", { name: "再来一局", exact: true }).click();
  await two.getByRole("button", { name: "再来一局", exact: true }).click();
  await expect(two.getByRole("button", { name: "我准备好了" })).toBeVisible();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  const third = await browser.newContext(),
    thirdPage = await third.newPage();
  await thirdPage.goto(url);
  await expect(
    thirdPage.getByRole("heading", { name: "这个房间已经有两个人啦" }),
  ).toBeVisible();
  const takeover = await a.newPage();
  await takeover.goto(url.replace("lag=300", "lag=600"));
  await expect(
    one.getByRole("heading", { name: "已在其他页面打开" }),
  ).toBeVisible();
  await expect(
    takeover.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  await new Promise((r) => setTimeout(r, 2000));
  await expect(
    one.getByRole("heading", { name: "已在其他页面打开" }),
  ).toBeVisible();
  await third.close();
  await a.close();
  await b.close();
});
test("actual 30-second offline interruption restores the same card on both phones", async ({
  browser,
}) => {
  const { a, b, one, two } = await createPair(browser);
  await start(one, two);
  await draw(one);
  const question = await one.getByTestId("card-question").textContent();
  await b.setOffline(true);
  await expect(
    one.getByRole("heading", { name: "TA 掉线了，等 TA 回来…" }),
  ).toBeVisible({ timeout: 16000 });
  await new Promise((r) => setTimeout(r, 30000));
  await b.setOffline(false);
  await expect(two.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
  await expect(one.getByTestId("card-question")).toHaveText(question!);
  await expect(two.getByTestId("card-question")).toHaveText(question!);
  await a.close();
  await b.close();
});
test("desktop and smallest mobile layouts, categories and playable game descriptions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /^和 TA 一起玩的\s*小游戏$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/home-desktop.png",
    fullPage: true,
  });
  await noOverflow(page);
  expect(await page.locator(".game-card").count()).toBe(10);
  await page.getByRole("button", { name: "较量", exact: true }).click();
  expect(await page.locator(".game-card").count()).toBe(1);
  await page.getByRole("button", { name: "了解爱心五子棋" }).click();
  await expect(
    page.getByRole("button", { name: "一起玩这个 ❤" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 640 });
  await noOverflow(page);
  await page.screenshot({
    path: "docs/evidence/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "我有房间码" }).click();
  await page.getByLabel("六位房间码").fill("k7p·qm2");
  await expect(page.getByLabel("六位房间码")).toHaveValue("K7PQM2");
});

test("200ms delay at 360×640, clipboard fallback and high-delay terminal takeover", async ({
  browser,
}) => {
  const { a, b, one, two, url } = await createPair(
    browser,
    "?lag=200&jitter=40",
  );
  await one.setViewportSize({ width: 360, height: 640 });
  await two.setViewportSize({ width: 360, height: 640 });
  await noOverflow(one);
  await noOverflow(two);
  await one.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
    document.execCommand = () => false;
  });
  await one.locator(".room-code-button").click();
  await expect(one.getByRole("textbox", { name: "邀请链接" })).toBeVisible();
  await one.getByRole("button", { name: "关闭", exact: true }).click();
  await start(one, two);
  await draw(one);
  await expect(two.getByTestId("card-question")).toHaveText(
    (await one.getByTestId("card-question").textContent())!,
  );
  await noOverflow(one);
  const next = await one
      .getByRole("button", { name: "聊好了，下一张 →" })
      .boundingBox(),
    bar = await one.locator(".social-bar").boundingBox();
  expect(next!.y + next!.height).toBeLessThan(bar!.y);
  await one.screenshot({ path: "docs/evidence/talk-360.png", fullPage: true });
  await one.getByRole("button", { name: "退出本局" }).click();
  await one.getByRole("button", { name: "结束本局", exact: true }).click();
  await one.getByRole("button", { name: "换个游戏", exact: true }).click();
  await expect(
    one.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  await one.goto(url.replace("lag=200", "lag=600"));
  await expect(
    one.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  const replacement = await a.newPage();
  await replacement.goto(url.replace("lag=200", "lag=600"));
  await expect(
    one.getByRole("heading", { name: "已在其他页面打开" }),
  ).toBeVisible();
  await expect(
    replacement.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  await new Promise((r) => setTimeout(r, 2200));
  await expect(
    one.getByRole("heading", { name: "已在其他页面打开" }),
  ).toBeVisible();
  await a.close();
  await b.close();
});
