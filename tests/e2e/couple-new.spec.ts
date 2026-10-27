import { test, expect, type Page, type Browser } from "@playwright/test";
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

test("local seat uses separate credentials and both can roll and complete turns", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await localPartner(p);
  await start(p, "情侣飞行棋");
  await expect(p.getByTestId("ludo-stage")).toBeVisible();
  await expect(p.locator(".game-overlay")).toBeHidden({ timeout: 12000 });
  await p.screenshot({ path: "test-results/new-ludo.png", fullPage: true });
  await p.getByRole("button", { name: "🎲 投掷骰子" }).click();
  await expect(p.locator(".ludo-task")).toBeVisible();
  await p.getByRole("button", { name: "完成，交给 TA" }).click();
  await expect(p.getByText("💞 当前：玩家 2")).toBeVisible();
  await p.getByRole("button", { name: "🎲 投掷骰子" }).click();
  expect(errors).toEqual([]);
  await c.close();
});

test("survival clues and local hide-and-seek use the correct seat and cover secrets on handoff", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  await localPartner(p);
  await start(p, "情侣求生欲", async () => {
    await p.getByLabel("玩法").selectOption("search");
  });
  const survival = p.getByTestId("survival-stage");
  await expect(survival).toBeVisible();
  await survival.getByRole("button", { name: "💡 提示" }).click();
  await expect(survival.locator(".couple-hint")).toBeVisible();
  await survival.getByRole("button", { name: "调查口红" }).click();
  await p.getByLabel("退出本局").click();
  await p.getByRole("button", { name: "结束本局" }).click();
  await p.getByRole("button", { name: "换个游戏" }).click();
  await start(p, "双人躲猫猫");
  const stage = p.getByTestId("hide-stage");
  await expect(stage).toBeVisible();
  const covers = stage.locator(".hide-room button");
  await covers.nth(7).click();
  await covers.nth(0).click();
  await covers.nth(1).click();
  await stage.getByRole("button", { name: "藏好了" }).click();
  await expect(p.getByRole("heading", { name: "请交给抓捕者" })).toBeVisible();
  await p.getByRole("button", { name: "开始寻找" }).click();
  await expect(p.getByTestId("hide-stage")).toContainText("还可寻找 3 次");
  await expect(p.locator(".hide-room .chosen")).toHaveCount(0);
  await c.close();
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
  await p.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await p.locator(".chef.player-1").boundingBox())?.x)
    .toBeGreaterThan(before!.x);
  const firstChef = await p.locator(".chef.player-0").boundingBox();
  const stick = p.getByRole("group", { name: "玩家1摇杆" });
  await stick.scrollIntoViewIfNeeded();
  const stickBox = (await stick.boundingBox())!;
  const cdp = await c.newCDPSession(p);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: stickBox.x + stickBox.width * 0.85,
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
  await one.getByRole("button", { name: "了解情侣找茬" }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await one.getByRole("button", { name: "我准备好了", exact: true }).click();
  await two.getByRole("button", { name: "我准备好了", exact: true }).click();
  await expect(one.locator(".game-overlay")).toBeHidden({ timeout: 20000 });
  await expect(one.getByTestId("spot-stage")).toBeVisible();
  await expect(two.getByTestId("spot-stage")).toBeVisible();
  const panels = one.locator(".spot-panel svg");
  const objectsA = panels.nth(0).locator(":scope > g");
  const objectsB = panels.nth(1).locator(":scope > g");
  const count = await objectsA.count();
  let difference = -1;
  for (let i = count - 10; i < count; i++) {
    if (
      (await objectsA.nth(i).innerHTML()) !==
        (await objectsB.nth(i).innerHTML()) ||
      (await objectsA.nth(i).getAttribute("transform")) !==
        (await objectsB.nth(i).getAttribute("transform"))
    ) {
      difference = i;
      break;
    }
  }
  expect(difference).toBeGreaterThanOrEqual(0);
  await objectsA
    .nth(difference)
    .locator("circle")
    .first()
    .click({ force: true });
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

test("local realtime hide-and-seek provides separate controls and views", async ({
  browser,
}) => {
  const { c, p } = await newRoom(browser);
  await localPartner(p);
  await start(p, "双人躲猫猫", async () => {
    await p.getByLabel("玩法").selectOption("realtime");
  });
  const choosing = p.getByTestId("hide-stage");
  await choosing.locator(".hide-room button").nth(7).click();
  await choosing.getByRole("button", { name: "藏好了" }).click();
  await expect(p.locator(".dual-hide")).toBeVisible();
  await expect(p.getByRole("group", { name: "抓捕者摇杆" })).toBeVisible();
  await expect(p.getByRole("group", { name: "躲藏者摇杆" })).toBeVisible();
  await p.screenshot({ path: "test-results/new-hide.png", fullPage: true });
  await c.close();
});
