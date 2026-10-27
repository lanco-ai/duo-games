import { test, expect } from "@playwright/test";

test("copy room number, paste it, and recover the same device after local cache is removed", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext({ viewport: { width: 320, height: 640 } });
  let one = await a.newPage();
  const two = await b.newPage();
  try {
    await one.goto("/");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByLabel("你的昵称").fill("原来的人");
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\/[A-Z2-9]{6}/);
    const code = one.url().match(/\/r\/([A-Z2-9]{6})/)![1];
    await expect(one.getByText("等 TA 加入…")).toBeVisible();
    await one.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).copied = value;
          },
        },
      }),
    );
    await one.getByRole("button", { name: "复制房间号" }).click();
    expect(await one.evaluate(() => (window as any).copied)).toBe(code);
    await one.getByRole("button", { name: /复制邀请链接/ }).click();
    expect(await one.evaluate(() => (window as any).copied)).toContain(
      "/r/" + code,
    );

    await two.goto("/");
    await two.getByRole("button", { name: "我有房间码" }).click();
    expect(
      await two.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await two.evaluate(
      (value) =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { readText: async () => value },
        }),
      code.slice(0, 3) + " · " + code.slice(3),
    );
    await two.getByRole("button", { name: "粘贴房间号" }).click();
    await expect(two.getByLabel("六位房间码")).toHaveValue(code);
    await two.getByLabel("六位房间码").fill(one.url());
    await expect(two.getByLabel("六位房间码")).toHaveValue(code);
    await two.getByRole("button", { name: "加入", exact: true }).click();
    await two.getByLabel("你的昵称").fill("伙伴");
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("伙伴");

    await one.close();
    one = await a.newPage();
    await one.goto("/");
    await one.getByRole("link", { name: /回到我们的房间/ }).click();
    await expect(one.locator(".couple-names")).toContainText("原来的人");
    await one.evaluate(() => localStorage.clear());
    await one.goto("/");
    await one.getByRole("link", { name: /回到我们的房间/ }).click();
    await expect(one.locator(".couple-names")).toContainText("原来的人");
    await expect(two.locator(".couple-names")).toContainText("伙伴");
  } finally {
    await a.close();
    await b.close();
  }
});

test("same-device two-seat credentials recover separately", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: /创建房间，邀请/ }).click();
    await page.getByLabel("你的昵称").fill("同屏甲");
    await page.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await page.getByRole("button", { name: "在这台设备上双人玩" }).click();
    await expect(page.locator(".couple-names")).toContainText("同屏玩家");
    const url = page.url(),
      code = url.match(/\/r\/([A-Z2-9]{6})/)![1];
    await page.evaluate(() => localStorage.clear());
    await page.goto(url);
    await expect(page.locator(".couple-names")).toContainText("同屏甲");
    await expect
      .poll(() =>
        page.evaluate(
          (c) => Boolean(localStorage.getItem("duo.localPeer." + c)),
          code,
        ),
      )
      .toBe(true);
    await expect(page.locator(".network-detail")).toContainText("TA 在线");
  } finally {
    await context.close();
  }
});

test("a browser that blocks web storage can still restore through its cookie", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    for (const name of ["getItem", "setItem", "removeItem"] as const)
      Object.defineProperty(Storage.prototype, name, {
        configurable: true,
        value: () => {
          throw new Error("storage unavailable");
        },
      });
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: /创建房间，邀请/ }).click();
    await page.getByLabel("你的昵称").fill("微信用户");
    await page.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(page.locator(".couple-names")).toContainText("微信用户");
    await page.goto("/");
    await page.getByRole("link", { name: /回到我们的房间/ }).click();
    await expect(page.locator(".couple-names")).toContainText("微信用户");
  } finally {
    await context.close();
  }
});
