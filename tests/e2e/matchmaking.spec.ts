import { test, expect } from "@playwright/test";

test("online count includes both browsers and deduplicates tabs", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const first = await a.newPage(),
    second = await b.newPage();
  try {
    await first.goto("/");
    await expect(first.locator(".online-count")).toContainText(
      /当前在线 \d+ 人/,
    );
    const initial = Number(
      (await first.locator(".online-count").innerText()).match(/\d+/)![0],
    );
    await second.goto("/");
    await expect(second.locator(".online-count")).toContainText(
      `当前在线 ${initial + 1} 人`,
    );
    const anotherTab = await a.newPage();
    await anotherTab.goto("/");
    await expect(anotherTab.locator(".online-count")).toContainText(
      `当前在线 ${initial + 1} 人`,
    );
    await expect(first.locator(".online-count")).toContainText(
      /当前在线 \d+ 人/,
    );
  } finally {
    await a.close();
    await b.close();
  }
});

test("random matching pairs two devices and opens the same room", async ({
  browser,
}) => {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const one = await a.newPage(),
    two = await b.newPage();
  try {
    for (const [page, name] of [
      [one, "小鹿"],
      [two, "小熊"],
    ] as const) {
      await page.goto("/");
      await page.getByRole("button", { name: "🎲 随机匹配在线玩家" }).click();
      await page.getByLabel("你的昵称").fill(name);
      await page.getByRole("button", { name: "开始随机匹配 ❤" }).click();
      if (page === one)
        await expect(page.getByText("正在寻找一起玩的伙伴…")).toBeVisible();
    }
    await expect(one).toHaveURL(/\/r\/[A-Z2-9]{6}/, { timeout: 15000 });
    await expect(two).toHaveURL(/\/r\/[A-Z2-9]{6}/, { timeout: 15000 });
    expect(new URL(one.url()).pathname).toBe(new URL(two.url()).pathname);
    await expect(one.locator(".couple-names")).toContainText("小熊");
    await expect(two.locator(".couple-names")).toContainText("小鹿");
  } finally {
    await a.close();
    await b.close();
  }
});

test("a player can cancel a pending match", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "🎲 随机匹配在线玩家" }).click();
  await page.getByLabel("你的昵称").fill("小鹿");
  await page.getByRole("button", { name: "开始随机匹配 ❤" }).click();
  await page.getByRole("button", { name: "取消匹配" }).click();
  await expect(page.getByText("正在寻找一起玩的伙伴…")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "🎲 随机匹配在线玩家" }),
  ).toBeVisible();
});
