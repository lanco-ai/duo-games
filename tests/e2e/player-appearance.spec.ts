import { test, expect } from "@playwright/test";

test("selected avatars and colors stay consistent on home and while reconnecting", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const one = await a.newPage(),
    two = await b.newPage();
  try {
    await one.goto("/");
    await expect(
      one.locator('.hero-couple [data-pair-seat="1"]'),
    ).toContainText("?");
    await one.getByRole("button", { name: /创建房间，邀请/ }).click();
    await one.getByRole("button", { name: "狐狸", exact: true }).click();
    await one.getByRole("button", { name: "薰衣草", exact: true }).click();
    await one.getByLabel("你的昵称").fill("狐狸甲");
    const fox = await one.locator(".profile-preview .critter").innerHTML();
    await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
    await expect(one).toHaveURL(/\/r\//);
    const roomURL = one.url();
    await two.goto(roomURL);
    await two.getByRole("button", { name: "企鹅", exact: true }).click();
    await two.getByRole("button", { name: "薄荷", exact: true }).click();
    await two.getByLabel("你的昵称").fill("企鹅乙");
    const penguin = await two.locator(".profile-preview .critter").innerHTML();
    await two.getByRole("button", { name: "进入房间 ❤" }).click();
    await expect(one.locator(".couple-names")).toContainText("企鹅乙");
    for (const page of [one, two]) {
      await expect
        .poll(() =>
          page.locator('.island-couple [data-pair-seat="0"]').innerHTML(),
        )
        .toBe(fox);
      await expect
        .poll(() =>
          page.locator('.island-couple [data-pair-seat="1"]').innerHTML(),
        )
        .toBe(penguin);
      await page.goto("/");
      await expect
        .poll(() =>
          page.locator('.hero-couple [data-pair-seat="0"]').innerHTML(),
        )
        .toBe(fox);
      await expect
        .poll(() =>
          page.locator('.hero-couple [data-pair-seat="1"]').innerHTML(),
        )
        .toBe(penguin);
    }
    await a.addInitScript(() => {
      const Original = WebSocket;
      window.WebSocket = class extends Original {
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
          if (typeof data === "string" && JSON.parse(data).t === "hello")
            setTimeout(() => super.send(data), 2500);
          else super.send(data);
        }
      };
    });
    await one.goto(roomURL);
    await expect(
      one.locator('.status-page [data-pair-seat="0"]'),
    ).toBeVisible();
    expect(
      await one.locator('.status-page [data-pair-seat="0"]').innerHTML(),
    ).toBe(fox);
    expect(
      await one.locator('.status-page [data-pair-seat="1"]').innerHTML(),
    ).toBe(penguin);
    await expect(one.locator(".lobby-layout")).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});
