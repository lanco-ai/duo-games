import { test, expect, type Page } from "@playwright/test";
import { firstDifference, kitchenWalk, jump } from "./redesign-helpers";

test("matched players can interact in all six new games", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const base = process.env.DUO_LIVE_URL || "http://127.0.0.1:8791/";
  const firstContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const secondContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const one = await firstContext.newPage(),
    two = await secondContext.newPage();
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  const names = [`测试甲${suffix}`, `测试乙${suffix}`];
  let owned = false;
  const start = async (name: string, setup?: (page: Page) => Promise<void>) => {
    await one.getByRole("button", { name: "了解" + name, exact: true }).click();
    await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
    await two.getByRole("button", { name: "好呀", exact: true }).click();
    await expect(
      one.getByRole("button", { name: "我准备好了", exact: true }),
    ).toBeVisible();
    if (setup) await setup(one);
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.locator(".game-overlay")).toBeVisible({ timeout: 15_000 });
    await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20_000 });
    await expect(two.locator(".game-overlay")).toBeHidden({ timeout: 20_000 });
  };
  const finish = async () => {
    if (!(await one.locator(".result-page").isVisible())) {
      await one.getByLabel("退出本局").click();
      await one.getByRole("button", { name: "结束本局" }).click();
    }
    await expect(one.locator(".result-page")).toBeVisible();
    await expect(two.locator(".result-page")).toBeVisible();
    await one.getByRole("button", { name: "换个游戏" }).click();
    await expect(
      one.getByRole("button", { name: "了解求生欲·双人版" }),
    ).toBeVisible();
  };
  try {
    for (const [page, name] of [
      [one, names[0]],
      [two, names[1]],
    ] as const) {
      await page.goto(base);
      await page.getByRole("button", { name: "🎲 随机匹配在线玩家" }).click();
      await page.getByLabel("你的昵称").fill(name);
      await page.getByRole("button", { name: "开始随机匹配 ❤" }).click();
      if (page === one)
        await expect(page.getByText("正在寻找一起玩的伙伴…")).toBeVisible({
          timeout: 5000,
        });
    }
    await expect(one).toHaveURL(/\/r\/[A-Z2-9]{6}/, { timeout: 15_000 });
    await expect(two).toHaveURL(/\/r\/[A-Z2-9]{6}/, { timeout: 15_000 });
    if (new URL(one.url()).pathname !== new URL(two.url()).pathname)
      throw new Error(
        "Matched an unrelated player; stopping without touching their room",
      );
    await expect(one.locator(".couple-names")).toContainText(names[1]);
    await expect(two.locator(".couple-names")).toContainText(names[0]);
    owned = true;
    console.log("MATCH: two browsers joined the same room");

    await start("求生欲·双人版");
    await one
      .getByRole("button", { name: /^高亮线索/ })
      .first()
      .click();
    await expect(two.locator(".survival-objects .chosen")).toHaveCount(1);
    await one.locator(".answer-options button").first().click();
    await expect(two.locator(".answer-pair")).toHaveCount(0);
    await two.locator(".answer-options button").first().click();
    await expect(two.locator(".answer-pair")).toBeVisible();
    await expect(one.getByTestId("survival-stage")).toContainText("求生成功");
    await finish();

    await start("各看一半");
    await firstDifference(one);
    await expect(two.getByTestId("spot-stage")).toContainText("找到 1 / 5");
    await finish();

    await start("双人厨房");
    const before = Number(
      await one.locator(".chef.player-1").getAttribute("data-x"),
    );
    await two.keyboard.down("d");
    await two.waitForTimeout(180);
    await two.keyboard.up("d");
    await expect
      .poll(async () =>
        Number(await one.locator(".chef.player-1").getAttribute("data-x")),
      )
      .toBeGreaterThan(before);
    await kitchenWalk(one, 0, 1, 0.7);
    await kitchenWalk(one, 0, 0.6, 0.7);
    await one.getByRole("button", { name: "操作🍅", exact: true }).click();
    await expect(one.getByTestId("kitchen-stage")).toContainText("待处理");
    await finish();

    await start("心动棋");
    await one
      .getByRole("button", { name: "🎲 投掷两颗骰子", exact: true })
      .click();
    await expect(one.getByRole("button", { name: /^选 \d 点$/ })).toHaveCount(
      2,
    );
    await one
      .getByRole("button", { name: "让一步 · 两颗都给 TA", exact: true })
      .click();
    await expect(two.getByTestId("ludo-stage")).toHaveAttribute(
      "data-turn",
      "1",
    );
    await two
      .getByRole("button", { name: "🎲 投掷两颗骰子", exact: true })
      .click();
    await two
      .getByRole("button", { name: "让一步 · 两颗都给 TA", exact: true })
      .click();
    await expect(one.getByTestId("ludo-stage")).toHaveAttribute(
      "data-turn",
      "0",
    );
    await finish();

    await start("房间里的秘密");
    for (const id of [8, 0, 3])
      await two
        .getByRole("button", { name: new RegExp("^布置.* " + id + "$") })
        .click();
    await two.getByRole("button", { name: "藏好了", exact: true }).click();
    await expect(one.getByTestId("hide-stage")).toContainText("还可搜查 6 次");
    await expect(one.locator(".hide-apartment button.chosen")).toHaveCount(0);
    await one.getByRole("button", { name: /^搜查.* 8$/ }).click();
    await expect(one.getByTestId("hide-stage")).toHaveAttribute(
      "data-phase",
      "round-end",
    );
    await expect(two.getByTestId("hide-stage")).toHaveAttribute(
      "data-phase",
      "round-end",
    );
    await finish();

    await start("双人跳一跳");
    await jump(one);
    await expect(two.getByTestId("jump-stage")).toContainText("轮到玩家 2");
    await expect(one.getByTestId("jump-stage")).toContainText("稳稳落地");
    await finish();

    await start("双人跳一跳", async (page) => {
      await page.getByLabel("玩法").selectOption("sync");
    });
    const duration = await Promise.all(
      [one, two].map(
        async (page, seat) =>
          Number(
            await page
              .getByTestId("jump-platform-" + seat)
              .getAttribute("data-distance"),
          ) * 4,
      ),
    );
    const order = duration[0] >= duration[1] ? [0, 1] : [1, 0],
      pages = [one, two];
    for (const page of pages) {
      const button = page.getByRole("button", {
        name: "按住蓄力 · 松开起跳",
        exact: true,
      });
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    await pages[order[0]].mouse.down();
    await one.waitForTimeout(Math.abs(duration[0] - duration[1]));
    await pages[order[1]].mouse.down();
    await one.waitForTimeout(Math.min(...duration));
    await Promise.all(pages.map((page) => page.mouse.up()));
    await expect(one.getByTestId("jump-stage")).toContainText(
      /心有灵犀|稳稳落地/,
    );
    await expect(two.getByTestId("jump-stage")).toContainText(
      /心有灵犀|稳稳落地/,
    );
    await finish();
  } finally {
    if (owned) {
      const result = await one.evaluate(async () => {
        const code = location.pathname.match(/\/r\/([A-Z2-9]{6})/)?.[1];
        const token = code && localStorage.getItem("duo.token." + code);
        if (!code || !token) return false;
        const base = location.pathname.replace(/r\/[A-Z2-9]{6}\/?$/, "");
        return (
          await fetch(base + "api/rooms/" + code, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          })
        ).ok;
      });
      if (!result) console.log("WARNING: test room could not be removed");
    }
    await firstContext.close();
    await secondContext.close();
  }
});
