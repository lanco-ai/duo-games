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
