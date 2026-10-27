import { test, expect, type Page } from "@playwright/test";

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
      one.getByRole("button", { name: "了解情侣求生欲" }),
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

    await start("情侣求生欲", async (page) => {
      await page.getByLabel("玩法").selectOption("quiz");
    });
    await one
      .getByTestId("survival-stage")
      .getByRole("button", { name: "💡 提示" })
      .click();
    await expect(two.locator(".couple-hint")).toBeVisible();
    await one.locator(".answer-options button").first().click();
    await expect(
      two.getByTestId("survival-stage").locator("[aria-live=polite]"),
    ).toBeVisible();
    console.log("PASS: survival shared action");
    await finish();

    await start("情侣找茬");
    const panels = one.locator(".spot-panel svg"),
      top = panels.nth(0).locator(":scope > g"),
      bottom = panels.nth(1).locator(":scope > g");
    const count = await top.count();
    let found = -1;
    for (let i = count - 10; i < count; i++) {
      if (
        (await top.nth(i).innerHTML()) !== (await bottom.nth(i).innerHTML()) ||
        (await top.nth(i).getAttribute("transform")) !==
          (await bottom.nth(i).getAttribute("transform"))
      ) {
        found = i;
        break;
      }
    }
    expect(found).toBeGreaterThanOrEqual(0);
    await top.nth(found).locator("circle").first().click({ force: true });
    await expect(two.getByTestId("spot-stage")).toContainText("找到 1 / 5");
    console.log("PASS: spot difference sync");
    await finish();

    await start("双人厨房");
    const before0 = await one.locator(".chef.player-0").boundingBox(),
      before1 = await one.locator(".chef.player-1").boundingBox();
    await two.keyboard.press("d");
    await expect
      .poll(async () => (await one.locator(".chef.player-1").boundingBox())?.x)
      .toBeGreaterThan(before1!.x);
    await one.keyboard.press("d");
    await expect
      .poll(async () => (await two.locator(".chef.player-0").boundingBox())?.x)
      .toBeGreaterThan(before0!.x);
    for (const page of [one, two]) {
      await page.keyboard.press("w");
      await page.waitForTimeout(150);
      await page.keyboard.press("w");
    }
    await one.getByRole("button", { name: "🥬 生菜" }).click();
    await two.getByRole("button", { name: "🥩 肉饼" }).click();
    await expect(one.getByTestId("kitchen-stage")).toContainText(
      "你拿着：🥬生",
    );
    await expect(two.getByTestId("kitchen-stage")).toContainText(
      "你拿着：🥩生",
    );
    console.log("PASS: both kitchen players move and pick up ingredients");
    await finish();

    await start("情侣飞行棋");
    await one.getByRole("button", { name: "🎲 投掷骰子" }).click();
    await expect(two.locator(".ludo-task")).toBeVisible();
    await one.getByRole("button", { name: "完成，交给 TA" }).click();
    await expect(two.getByText("💞 当前：玩家 2")).toBeVisible();
    await two.getByRole("button", { name: "🎲 投掷骰子" }).click();
    await expect(one.locator(".ludo-task")).toBeVisible();
    console.log("PASS: ludo turns on both devices");
    await finish();

    await start("双人躲猫猫");
    const hiding = two.getByTestId("hide-stage").locator(".hide-room button");
    await hiding.nth(7).click();
    await hiding.nth(0).click();
    await hiding.nth(1).click();
    await two.getByRole("button", { name: "藏好了" }).click();
    await expect(one.getByTestId("hide-stage")).toContainText("还可寻找 3 次");
    await expect(one.locator(".hide-room .chosen")).toHaveCount(0);
    await one
      .getByTestId("hide-stage")
      .locator(".hide-room button")
      .nth(7)
      .click();
    await expect(one.locator(".result-page")).toBeVisible();
    await expect(two.locator(".result-page")).toBeVisible();
    console.log("PASS: hide and seek privacy and shared result");
    await finish();

    await start("双人跳一跳");
    const charge = one.getByRole("button", { name: "按住蓄力 · 松开起跳" });
    const box = (await charge.boundingBox())!;
    await one.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await one.mouse.down();
    await one.waitForTimeout(800);
    await one.mouse.up();
    await expect
      .poll(
        async () =>
          (await two.getByTestId("jump-stage").count()) === 0 ||
          (await two.getByTestId("jump-stage").textContent())?.includes(
            "轮到玩家 2",
          ),
      )
      .toBeTruthy();
    console.log("PASS: jump outcome synchronized");
    await finish();

    await start("双人跳一跳", async (page) => {
      await page.getByLabel("玩法").selectOption("sync");
    });
    const buttonA = one.getByRole("button", { name: "按住蓄力 · 松开起跳" });
    const buttonB = two.getByRole("button", { name: "按住蓄力 · 松开起跳" });
    const boundsA = (await buttonA.boundingBox())!,
      boundsB = (await buttonB.boundingBox())!;
    await Promise.all([
      one.mouse.move(
        boundsA.x + boundsA.width / 2,
        boundsA.y + boundsA.height / 2,
      ),
      two.mouse.move(
        boundsB.x + boundsB.width / 2,
        boundsB.y + boundsB.height / 2,
      ),
    ]);
    await Promise.all([one.mouse.down(), two.mouse.down()]);
    await one.waitForTimeout(800);
    await Promise.all([one.mouse.up(), two.mouse.up()]);
    await expect
      .poll(
        async () =>
          (await two.getByTestId("jump-stage").count()) === 0 ||
          (await two.getByTestId("jump-stage").textContent())?.includes(
            "心有灵犀",
          ) ||
          (await two.getByTestId("jump-stage").textContent())?.includes(
            "稳稳落地",
          ) ||
          (await two.getByTestId("jump-stage").textContent())?.includes(
            "完美落点",
          ),
      )
      .toBeTruthy();
    console.log("PASS: both players charge in sync");
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
