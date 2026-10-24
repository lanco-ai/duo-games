import { build } from "vite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createApp } from "../dist/server.js";
const temp = mkdtempSync(join(tmpdir(), "duo-subpath-"));
await build({
  base: "/duo/",
  build: { outDir: join(temp, "web"), emptyOutDir: false },
});
const app = createApp({
  base: "/duo/",
  web: join(temp, "web"),
  data: join(temp, "duo.db"),
});
let browser;
try {
  const port = await app.listen(0);
  browser = await chromium.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const a = await browser.newContext(),
    b = await browser.newContext();
  const one = await a.newPage(),
    two = await b.newPage();
  const errors = [];
  for (const page of [one, two]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  }
  await one.goto("http://127.0.0.1:" + port + "/duo/");
  await one.getByRole("button", { name: /创建房间，邀请/ }).click();
  await one.getByLabel("你的昵称").fill("子路径甲");
  await one.getByRole("button", { name: "创建我们的房间 ❤" }).click();
  await expect(one).toHaveURL(/\/duo\/r\//);
  await expect(one.getByText("等 TA 加入…")).toBeVisible();
  await two.goto(one.url());
  await two.getByLabel("你的昵称").fill("子路径乙");
  await two.getByRole("button", { name: "进入房间 ❤" }).click();
  await expect(
    two.getByRole("button", { name: "了解深夜聊天卡" }),
  ).toBeVisible();
  await one.getByRole("button", { name: "了解深夜聊天卡" }).click();
  await one.getByRole("button", { name: "一起玩这个 ❤" }).click();
  await two.getByRole("button", { name: "好呀", exact: true }).click();
  await one.getByRole("button", { name: "我准备好了" }).click();
  await two.getByRole("button", { name: "我准备好了" }).click();
  await expect(one.getByTestId("talk-card")).toBeEnabled({ timeout: 10000 });
  await one.getByTestId("talk-card").click();
  await expect(one.getByTestId("card-question")).toBeVisible();
  await expect(two.getByTestId("card-question")).toHaveText(
    await one.getByTestId("card-question").textContent(),
  );
  expect(errors).toEqual([]);
  console.log(
    "PASS: /duo/ assets, routes, HTTP, WebSocket, lazy game chunk and synced card on two clients",
  );
} finally {
  await browser?.close();
  await app.close();
  rmSync(temp, { recursive: true, force: true });
}
