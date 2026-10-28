import { test, expect, type Browser, type Page } from "@playwright/test";
async function pair(browser: Browser) {
  const a = await browser.newContext({ viewport: { width: 375, height: 667 } }),
    b = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const one = await a.newPage(),
    two = await b.newPage();
  await one.goto("/");
  await one.getByRole("button", { name: /创建房间，邀请/ }).click();
  await one.getByLabel("你的昵称").fill("测试甲");
  await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
  await expect(one.getByText("等 TA 加入…")).toBeVisible();
  await two.goto(one.url());
  await two.getByLabel("你的昵称").fill("测试乙");
  await two.getByRole("button", { name: "进入房间 ❤" }).click();
  await expect(one.locator(".couple-names")).toContainText("测试乙");
  return { a, b, one, two };
}
async function start(one: Page, two: Page, name: string) {
  await one.getByRole("button", { name: "了解" + name, exact: true }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await one.getByRole("button", { name: "我准备好了", exact: true }).click();
  await two.getByRole("button", { name: "我准备好了", exact: true }).click();
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
}
test("P1 two browser contexts finish the grass journey and rematch", async ({
  browser,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "双人跳一跳");
    await expect(one.getByTestId("jump-stage")).toBeVisible();
    for (let i = 0; i < 10; i++) {
      const page = i % 2 ? two : one;
      const distance = Number(
        await page.getByTestId("jump-platform-0").getAttribute("data-distance"),
      );
      const button = page.getByRole("button", { name: "按住蓄力 · 松开起跳" });
      await expect(button).toBeEnabled();
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(distance * 4);
      await page.mouse.up();
    }
    await expect(one.locator(".result-page")).toBeVisible();
    await expect(two.locator(".result-page")).toBeVisible();
    await expect(one.locator(".result-page")).toContainText("旅程通关");
    await one.getByRole("button", { name: /再来一局/ }).click();
    await two.getByRole("button", { name: /再来一局/ }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("jump-stage")).toBeVisible({ timeout: 20000 });
  } finally {
    await a.close();
    await b.close();
  }
});

test("P2 two cooks move without action round trips, interact, settle and rematch", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "双人厨房");
    await expect(one.getByTestId("kitchen-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    const chef = one.locator(".chef.player-0");
    const before = Number(await chef.getAttribute("data-y"));
    await one.keyboard.down("w");
    await one.waitForTimeout(500);
    await one.keyboard.up("w");
    await expect
      .poll(async () => Number(await chef.getAttribute("data-y")))
      .toBeLessThan(before - 1);
    await one.keyboard.down("w");
    await one.waitForTimeout(350);
    await one.keyboard.up("w");
    await one.keyboard.down("a");
    await one.waitForTimeout(100);
    await one.keyboard.up("a");
    await one.getByRole("button", { name: "操作🍅", exact: true }).click();
    await expect(one.getByTestId("kitchen-stage")).toContainText("待处理");
    await two.keyboard.down("a");
    await two.waitForTimeout(300);
    await two.keyboard.up("a");
    await expect
      .poll(async () =>
        Number(await two.locator(".chef.player-1").getAttribute("data-x")),
      )
      .toBeLessThan(6);
    await expect(one.locator(".kitchen-tickets > div")).toHaveCount(2);
    const advanced = await request.post("http://127.0.0.1:8792/advance", {
      data: { ms: 121000 },
    });
    expect(advanced.ok()).toBe(true);
    await expect(one.locator(".result-page")).toContainText("厨房打烊");
    await expect(two.locator(".result-page")).toContainText("厨房打烊");
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("kitchen-stage")).toBeVisible({
      timeout: 20000,
    });
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await a.close();
    await b.close();
  }
});

test("P3 both seats privately choose five answers, settle and rematch", async ({
  browser,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "求生欲·双人版");
    await expect(one.getByTestId("survival-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    for (let idx = 0; idx < 5; idx++) {
      await one.locator(".answer-options button").nth(0).click();
      await expect(two.locator(".answer-pair")).toHaveCount(0);
      await two.locator(".answer-options button").nth(0).click();
      await expect(one.locator(".answer-pair")).toBeVisible();
      await one.getByRole("button", { name: "下一题", exact: true }).click();
    }
    await expect(one.locator(".result-page")).toContainText("我们的求生指数");
    await expect(two.locator(".result-page")).toContainText("100%");
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("survival-stage")).toBeVisible({
      timeout: 20000,
    });
    expect(
      await one.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await a.close();
    await b.close();
  }
});
