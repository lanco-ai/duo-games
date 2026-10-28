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

test("P4 two browsers compare tutorial pictures, share finds, settle and rematch", async ({
  browser,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "各看一半");
    await expect(one.getByTestId("spot-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    const top = one.locator(".spot-panel svg").nth(0),
      bottom = one.locator(".spot-panel svg").nth(1);
    const candidates = await top.locator("g[data-id]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-id"),
        html: n.innerHTML,
      })),
    );
    const other = await bottom.locator("g[data-id]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-id"),
        html: n.innerHTML,
      })),
    );
    const diffs = candidates.filter(
      (x) => other.find((y) => y.id === x.id)?.html !== x.html,
    );
    expect(diffs).toHaveLength(5);
    for (let i = 0; i < diffs.length; i++) {
      const object = top.locator('g[data-id="' + diffs[i].id + '"] rect');
      await object.click({ force: true });
      if (i < 4)
        await expect(two.getByTestId("spot-stage")).toContainText(
          "找到 " + (i + 1) + " / 5",
        );
    }
    await expect(one.locator(".result-page")).toContainText("找到了全部不同");
    await expect(two.locator(".result-page")).toContainText("5 / 5");
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("spot-stage")).toBeVisible({ timeout: 20000 });
  } finally {
    await a.close();
    await b.close();
  }
});

test("P5 two partners choose dice and complete the cooperative route before rematching", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "心动棋");
    await expect(one.getByTestId("ludo-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    for (let n = 0; n < 170; n++) {
      if (await one.locator(".result-page").isVisible()) break;
      const stage = one.getByTestId("ludo-stage");
      const phase = await stage.getAttribute("data-phase"),
        turn = Number(await stage.getAttribute("data-turn"));
      const page = turn ? two : one,
        other = turn ? one : two;
      const before = await stage.getAttribute("data-state");
      if (phase === "roll")
        await page
          .getByRole("button", { name: "🎲 投掷两颗骰子", exact: true })
          .click();
      else if (phase === "choose") {
        const buttons = page.getByRole("button", { name: /^选 \d 点$/ });
        const labels = await buttons.allTextContents();
        const index =
          Number(labels[0].match(/\d/)![0]) >= Number(labels[1].match(/\d/)![0])
            ? 0
            : 1;
        await buttons.nth(index).click();
      } else if (phase === "truth" || phase === "memory") {
        await page
          .getByLabel("写一句", { exact: true })
          .fill("一起走过的路都很珍贵");
        await page.getByRole("button", { name: "提交", exact: true }).click();
      } else if (phase === "rate")
        await other
          .getByRole("button", { name: "❤️❤️❤️", exact: true })
          .click();
      else if (phase === "fork")
        await page
          .getByRole("button", { name: "远路 · 稳走一步", exact: true })
          .click();
      else if (phase === "challenge") {
        const kind = await stage.getAttribute("data-task");
        if (kind === "word") {
          await one.getByLabel("写一句", { exact: true }).fill("心动");
          await one.getByRole("button", { name: "提交", exact: true }).click();
          await two.getByLabel("写一句", { exact: true }).fill("心动");
          await two.getByRole("button", { name: "提交", exact: true }).click();
        } else {
          await one
            .getByRole("button", { name: "玩家 1：一起完成了", exact: true })
            .click();
          await two
            .getByRole("button", { name: "玩家 2：一起完成了", exact: true })
            .click();
        }
      }
      await expect
        .poll(async () =>
          (await one.locator(".result-page").isVisible())
            ? "result"
            : await stage.getAttribute("data-state"),
        )
        .not.toBe(before);
    }
    await expect(one.locator(".result-page")).toContainText("两个人都抵达承诺");
    await expect(two.locator(".result-page")).toBeVisible();
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("ludo-stage")).toBeVisible({ timeout: 20000 });
  } finally {
    await a.close();
    await b.close();
  }
});
