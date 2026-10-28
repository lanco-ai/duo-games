import { test, expect, type Browser, type Page } from "@playwright/test";
import { observe, gameData, kitchenWalk } from "./redesign-helpers";
async function pair(browser: Browser) {
  const a = await browser.newContext({ viewport: { width: 375, height: 667 } }),
    b = await browser.newContext({ viewport: { width: 375, height: 667 } });
  await observe(a);
  await observe(b);
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
test("P1 two browser contexts reload during a charge, finish the grass journey and rematch", async ({
  browser,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "双人跳一跳");
    await expect(one.getByTestId("jump-stage")).toBeVisible();
    await expect(one.locator('[data-testid^="jump-animal-"]')).toHaveCount(2);
    for (let i = 0; i < 10; i++) {
      const page = i % 2 ? two : one;
      if (i === 2) {
        const held = page.getByRole("button", {
          name: "按住蓄力 · 松开起跳",
          exact: true,
        });
        await expect(held).toBeEnabled();
        await held.scrollIntoViewIfNeeded();
        const box = (await held.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await expect
          .poll(async () => (await gameData(page)).charging[0])
          .toBe(true);
        await page.reload();
        await page.mouse.up();
        await page.waitForFunction(
          () => (window as any).duoTest.room?.phase === "playing",
        );
        await expect(page.locator(".game-overlay")).toBeHidden();
        expect((await gameData(page)).charging).toEqual([false, false]);
      }
      const button = page.getByRole("button", { name: "按住蓄力 · 松开起跳" });
      await expect(button).toBeEnabled();
      const distance = Number(
        await page.getByTestId("jump-platform-0").getAttribute("data-distance"),
      );
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(distance * 4);
      await page.mouse.up();
      if (i === 0)
        expect(
          Number(
            await page
              .getByTestId("jump-platform-0")
              .getAttribute("data-distance"),
          ),
        ).toBe(distance);
      await expect.poll(async () => (await gameData(page)).step).toBe(i + 1);
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

test("P2 two cooks prepare real orders, earn a star, settle and rematch", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const { a, b, one, two } = await pair(browser);
  const operate = async (page: Page, icon: string, hold = false) => {
    // Face the intended counter after walking; a tiny coordinate correction may
    // otherwise leave the chef facing away from a nearby worktop.
    const face: Record<string, string> = {
      "🍅": "a",
      "🥬": "w",
      "🍞": "d",
      "🔪": "a",
      "🍽️": "s",
      "🔔": "w",
    };
    await page.keyboard.press(face[icon]);
    const button = page.getByRole("button", {
      name: "操作" + icon,
      exact: true,
    });
    await expect(button).toBeEnabled();
    if (!hold) {
      await button.click();
      return;
    }
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect
      .poll(async () => (await gameData(page)).boards[0]?.stage)
      .toBe("chopped");
    await page.mouse.up();
  };
  const chop = async (page: Page, seat: number) => {
    await kitchenWalk(page, seat, 1, 0.7);
    await kitchenWalk(page, seat, 0.7, 2);
    await operate(page, "🔪");
    await operate(page, "🔪", true);
    await operate(page, "🔪");
    await expect(page.getByTestId("kitchen-stage")).toContainText("已切");
    await kitchenWalk(page, seat, 1, 6.2);
    await kitchenWalk(page, seat, 2, 6.2);
    await operate(page, "🍽️");
  };
  try {
    await start(one, two, "双人厨房");
    await expect(one.getByTestId("kitchen-stage")).toBeVisible();
    await expect(one.locator(".kitchen-tickets > div")).toHaveCount(2);
    for (let served = 0; served < 3; served++) {
      if (served) {
        await kitchenWalk(two, 1, 6, 6.2);
        await kitchenWalk(two, 1, 2, 6.2);
        await operate(two, "🍽️");
      }
      const kind = (await gameData(one)).orders[0].kind;
      expect(["salad", "sandwich"]).toContain(kind);
      console.log(`Cooking order ${served + 1}: ${kind}`);
      await kitchenWalk(one, 0, 1, 0.7);
      await kitchenWalk(one, 0, 0.6, 0.7);
      await operate(one, "🍅");
      await chop(one, 0);
      if (kind === "salad") {
        await kitchenWalk(two, 1, 6, 0.7);
        await kitchenWalk(two, 1, 2, 0.7);
        await operate(two, "🥬");
        await chop(two, 1);
      } else {
        await kitchenWalk(two, 1, 6, 0.7);
        await kitchenWalk(two, 1, 6.4, 0.7);
        await operate(two, "🍞");
        await kitchenWalk(two, 1, 6, 6.2);
        await kitchenWalk(two, 1, 2, 6.2);
        await operate(two, "🍽️");
      }
      await operate(two, "🍽️");
      await kitchenWalk(two, 1, 6, 0.7);
      await operate(two, "🔔");
      await expect
        .poll(async () => (await gameData(one)).served)
        .toBe(served + 1);
    }
    expect((await gameData(one)).score).toBeGreaterThanOrEqual(300);
    const advanced = await request.post("http://127.0.0.1:8792/advance", {
      data: { ms: 121000 },
    });
    expect(advanced.ok()).toBe(true);
    await expect(one.locator(".result-page")).toContainText("厨房打烊");
    await expect(two.locator(".result-page")).toContainText("3 单");
    await expect(one.locator(".result-page h1")).toContainText("★");
    // Advancing the server clock can expire its transport liveness lease.
    // Wait for both real UI connections before asking either seat to rematch.
    await expect(
      one.getByRole("button", { name: "发送❤️", exact: true }),
    ).toBeEnabled();
    await expect(
      two.getByRole("button", { name: "发送❤️", exact: true }),
    ).toBeEnabled();
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

test("P6 two browsers hide, search and exchange roles over three rounds then rematch", async ({
  browser,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    await start(one, two, "房间里的秘密");
    await expect(one.getByTestId("hide-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    for (let round = 0; round < 3; round++) {
      const hider = Number(
        await one.getByTestId("hide-stage").getAttribute("data-hider"),
      );
      const hide = hider ? two : one,
        seek = hider ? one : two;
      for (const id of [8, 0, 3])
        await hide
          .getByRole("button", { name: new RegExp("^布置.* " + id + "$") })
          .click();
      await hide.getByRole("button", { name: "藏好了", exact: true }).click();
      await expect(seek.getByTestId("hide-stage")).toHaveAttribute(
        "data-phase",
        "seek",
      );
      await expect(seek.locator(".hide-apartment button.chosen")).toHaveCount(
        0,
      );
      await seek.getByRole("button", { name: /^搜查.* 8$/ }).click();
      await expect(one.getByTestId("hide-stage")).toHaveAttribute(
        "data-phase",
        "round-end",
      );
      await one
        .getByRole("button", {
          name: round === 2 ? "查看结算" : "交换身份，下一轮",
          exact: true,
        })
        .click();
      if (round < 2)
        await expect(one.getByTestId("hide-stage")).toHaveAttribute(
          "data-round",
          String(round + 1),
        );
    }
    await expect(one.locator(".result-page")).toContainText("房间里的秘密");
    await expect(two.locator(".result-page")).toBeVisible();
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("hide-stage")).toBeVisible({ timeout: 20000 });
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

test("P7 rhythm partners settle a song and return for another chart", async ({
  browser,
  request,
}) => {
  const { a, b, one, two } = await pair(browser);
  try {
    // The calibration UI has its own browser regression; use a measured zero-offset device fixture here.
    await one.evaluate(() => localStorage.setItem("duo.inputOffset", "0"));
    await two.evaluate(() => localStorage.setItem("duo.inputOffset", "0"));
    await start(one, two, "心跳节拍");
    await expect(one.getByTestId("heartbeat-stage")).toBeVisible();
    await expect(two.getByTestId("heartbeat-stage")).toBeVisible();
    await expect(one.locator(".game-overlay")).toBeHidden();
    await one.waitForTimeout(2600);
    await one.keyboard.press("f");
    await two.keyboard.press("j");
    const result = await request.post("http://127.0.0.1:8792/advance", {
      data: { ms: 75000 },
    });
    expect(result.ok()).toBe(true);
    await expect(one.locator(".result-page")).toContainText("我们的心跳同步率");
    await expect(two.locator(".result-page")).toContainText("副歌连打");
    await expect(
      one.getByRole("button", { name: "发送❤️", exact: true }),
    ).toBeEnabled();
    await expect(
      two.getByRole("button", { name: "发送❤️", exact: true }),
    ).toBeEnabled();
    await one.getByRole("button", { name: "再来一局", exact: true }).click();
    await two.getByRole("button", { name: "再来一局", exact: true }).click();
    await one.getByRole("button", { name: "我准备好了", exact: true }).click();
    await two.getByRole("button", { name: "我准备好了", exact: true }).click();
    await expect(one.getByTestId("heartbeat-stage")).toBeVisible({
      timeout: 20000,
    });
  } finally {
    await a.close();
    await b.close();
  }
});
