import { test, expect, type Page, type Browser } from "@playwright/test";
import { firstDifference } from "./redesign-helpers";
test.setTimeout(45000);
test.use({ actionTimeout: 10000 });

async function newRoom(browser: Browser) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    p = await c.newPage();
  await p.goto("/");
  await p.getByRole("button", { name: /创建房间，邀请/ }).click();
  await p.getByLabel("你的昵称").fill("小鹿");
  await p.getByRole("button", { name: "创建我们的房间 ❤" }).click();
  await expect(p.getByText("等 TA 加入…")).toBeVisible();
  return { c, p };
}
async function localPartner(p: Page) {
  await p.getByRole("button", { name: "在这台设备上双人玩" }).click();
  await expect(p.locator(".couple-names")).toContainText("同屏玩家");
  await expect(p.locator(".network-detail")).toContainText("TA 在线");
}
async function start(p: Page, name: string, setup?: () => Promise<void>) {
  await p.getByRole("button", { name: "了解" + name, exact: true }).click();
  await p.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await expect(
    p.getByRole("button", { name: "我准备好了", exact: true }),
  ).toBeEnabled();
  if (setup) await setup();
  await p.getByRole("button", { name: "我准备好了", exact: true }).click();
  await expect(p.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
}

test("local seats can choose dice and pass turns with separate authority", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  try {
    await localPartner(p);
    await start(p, "心动棋");
    await expect(p.getByTestId("ludo-stage")).toBeVisible();
    await p
      .getByRole("button", { name: "🎲 投掷两颗骰子", exact: true })
      .click();
    await expect(p.getByRole("button", { name: /^选 \d 点$/ })).toHaveCount(2);
    await p
      .getByRole("button", { name: "让一步 · 两颗都给 TA", exact: true })
      .click();
    await expect(p.getByTestId("ludo-stage")).toHaveAttribute("data-turn", "1");
    await p
      .getByRole("button", { name: "🎲 投掷两颗骰子", exact: true })
      .click();
    await p
      .getByRole("button", { name: "让一步 · 两颗都给 TA", exact: true })
      .click();
    await expect(p.getByTestId("ludo-stage")).toHaveAttribute("data-turn", "0");
  } finally {
    await c.close();
  }
});

test("local hide-and-seek covers the hiding place on handoff", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  try {
    await localPartner(p);
    await start(p, "房间里的秘密");
    await expect(
      p.getByRole("heading", { name: "请交给玩家 2", exact: true }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    for (const id of [8, 0, 3])
      await p
        .getByRole("button", { name: new RegExp("^布置.* " + id + "$") })
        .click();
    await p.getByRole("button", { name: "藏好了", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "请交给玩家 1", exact: true }),
    ).toBeVisible();
    await expect(p.getByTestId("hide-stage")).toHaveCount(0);
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await expect(p.getByTestId("hide-stage")).toContainText("还可搜查 6 次");
    await expect(p.locator(".hide-apartment button.chosen")).toHaveCount(0);
    await p.getByRole("button", { name: /^搜查.* 8$/ }).click();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await expect(p.getByTestId("hide-stage")).toContainText("本轮已结束");
  } finally {
    await c.close();
  }
});

test("blind answers remain hidden until five seconds, and Pro cards use a separate dare pool", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  await localPartner(p);
  await start(p, "你懂我吗", async () => {
    await p.getByLabel("玩法").selectOption("blind");
  });
  const players = p.locator(".dual-blind .know-stage");
  await expect(players).toHaveCount(2);
  await players.nth(0).locator(".choice").first().click();
  await players.nth(0).getByRole("button", { name: "锁定我的答案 ❤" }).click();
  await players.nth(1).locator(".choice").first().click();
  await players.nth(1).getByRole("button", { name: "锁定我的答案 ❤" }).click();
  await expect(players.nth(0).locator(".answer-pair")).toBeVisible({
    timeout: 7000,
  });
  await p.getByLabel("退出本局").click();
  await p.getByRole("button", { name: "结束本局" }).click();
  await p.getByRole("button", { name: "换个游戏" }).click();
  await start(p, "深夜聊天卡", async () => {
    await p.getByLabel("聊天玩法").selectOption("pro");
  });
  await p.getByRole("button", { name: "🔥 大冒险", exact: true }).click();
  await p.getByRole("button", { name: "🎲 摇骰子" }).click();
  await expect(p.locator(".trigger-result")).toContainText("大冒险");
  await p.getByRole("button", { name: "使用惩罚券" }).click();
  await expect(p.getByText("本次：惩罚券")).toBeVisible();
  await c.close();
});

test("same device opens both kitchen and jumping controls with separate seat authority", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  await localPartner(p);
  await start(p, "双人厨房");
  await expect(p.getByTestId("kitchen-stage")).toBeVisible();
  await expect(p.locator(".game-overlay")).toBeHidden({ timeout: 12000 });
  await p.screenshot({ path: "test-results/new-kitchen.png", fullPage: true });
  await expect(p.getByRole("group", { name: "玩家1摇杆" })).toBeVisible();
  await expect(p.getByRole("group", { name: "玩家2摇杆" })).toBeVisible();
  const before = await p.locator(".chef.player-1").boundingBox();
  expect(before).not.toBeNull();
  await p.keyboard.down("ArrowRight");
  await p.waitForTimeout(200);
  await p.keyboard.up("ArrowRight");
  await expect
    .poll(async () => (await p.locator(".chef.player-1").boundingBox())?.x)
    .toBeGreaterThan(before!.x);
  const firstChef = await p.locator(".chef.player-0").boundingBox();
  const stick = p
    .getByRole("group", { name: "玩家1摇杆" })
    .getByRole("button", { name: "→", exact: true });
  await stick.scrollIntoViewIfNeeded();
  const stickBox = (await stick.boundingBox())!;
  const cdp = await c.newCDPSession(p);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: stickBox.x + stickBox.width / 2,
        y: stickBox.y + stickBox.height / 2,
      },
    ],
  });
  await p.waitForTimeout(300);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => (await p.locator(".chef.player-0").boundingBox())?.x)
    .toBeGreaterThan(firstChef!.x);
  await cdp.detach();
  await p.getByLabel("退出本局").click();
  await p.getByRole("button", { name: "结束本局" }).click();
  await expect(p.locator(".result-page")).toBeVisible();
  await p.getByRole("button", { name: "换个游戏" }).click();
  await start(p, "双人跳一跳");
  await expect(p.getByTestId("jump-stage")).toBeVisible();
  await expect(
    p.getByRole("button", { name: /玩家一：按住蓄力/ }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: /玩家二：按住蓄力/ }),
  ).toBeDisabled();
  await c.close();
});

test("two remote seats see shared difference progress and can reconnect", async ({
  browser,
}) => {
  const { c: a, p: one } = await newRoom(browser);
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    two = await b.newPage();
  await two.goto(one.url());
  await two.getByLabel("你的昵称").fill("阿北");
  await two.getByRole("button", { name: "进入房间 ❤" }).click();
  await expect(one.locator(".couple-names")).toContainText("阿北");
  await one.getByRole("button", { name: "了解各看一半" }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await one.getByRole("button", { name: "我准备好了", exact: true }).click();
  await two.getByRole("button", { name: "我准备好了", exact: true }).click();
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
  await expect(one.getByTestId("spot-stage")).toBeVisible();
  await expect(two.getByTestId("spot-stage")).toBeVisible();
  await firstDifference(one);
  await expect(one.getByTestId("spot-stage")).toContainText("找到 1 / 5");
  await expect(two.getByTestId("spot-stage")).toContainText("找到 1 / 5");
  await two.reload();
  await expect(two.getByTestId("spot-stage")).toBeVisible({ timeout: 20000 });
  await expect(two.getByTestId("spot-stage")).toContainText("找到 1 / 5");
  expect(
    await one.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await a.close();
  await b.close();
});

test("local hiding partner can relocate and play dead behind a handoff cover", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  try {
    await localPartner(p);
    await start(p, "房间里的秘密");
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    for (const id of [8, 0, 3])
      await p
        .getByRole("button", { name: new RegExp("^布置.* " + id + "$") })
        .click();
    await p.getByRole("button", { name: "藏好了", exact: true }).click();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await p
      .getByRole("button", { name: "遮挡屏幕，交给玩家 2", exact: true })
      .click();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await p
      .getByRole("button", { name: "换位 · 剩余 2 次", exact: true })
      .click();
    await p.getByRole("button", { name: /^搜查.* 7$/ }).click();
    await expect(
      p.getByRole("button", { name: "换位 · 剩余 1 次", exact: true }),
    ).toBeVisible();
    await p.getByRole("button", { name: "装死 · 一次", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "装死 · 一次", exact: true }),
    ).toBeDisabled();
    await p
      .getByRole("button", { name: "遮挡屏幕，交给玩家 1", exact: true })
      .click();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await expect(p.locator(".hide-apartment button.chosen")).toHaveCount(0);
    await p.getByRole("button", { name: /^搜查.* 7$/ }).click();
    await expect(p.getByTestId("hide-stage")).toContainText("很安静");
    await p.getByRole("button", { name: /^搜查.* 7$/ }).click();
    await p
      .getByRole("button", { name: "准备好了，打开我的视图", exact: true })
      .click();
    await expect(p.getByTestId("hide-stage")).toContainText("本轮已结束");
  } finally {
    await c.close();
  }
});
