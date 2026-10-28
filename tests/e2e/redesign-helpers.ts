import { expect, type Page, type BrowserContext } from "@playwright/test";

export async function observe(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as any,
      Original = WebSocket,
      parts = new Map();
    w.duoTest = { room: null, game: null, events: [] };
    w.WebSocket = class extends Original {
      constructor(...args: any[]) {
        super(args[0], args[1]);
        this.addEventListener("message", (e) => {
          let m = JSON.parse(String(e.data));
          if (m.t === "part") {
            const p = parts.get(m.id) || [];
            parts.set(m.id, p);
            p[m.index] = m.text;
            if (p.filter(Boolean).length !== m.total) return;
            m = JSON.parse(p.join(""));
          }
          if (m.t === "welcome") {
            w.duoTest.room = m.room;
            w.duoTest.game = m.game;
          }
          if (m.t === "room") w.duoTest.room = m.room;
          if (m.t === "game") w.duoTest.game = m.view;
          if (m.t === "extra") w.duoTest.events.push(m.event);
        });
      }
    };
  });
}
export const gameData = (page: Page) =>
  page.evaluate(() => (window as any).duoTest.game?.data);

export async function firstDifference(page: Page) {
  const panels = page.locator(".spot-panel svg"),
    top = panels.nth(0),
    bottom = panels.nth(1);
  const original = await top
    .locator("g[data-id]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ id: n.getAttribute("data-id"), html: n.innerHTML })),
    );
  const modified = await bottom
    .locator("g[data-id]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ id: n.getAttribute("data-id"), html: n.innerHTML })),
    );
  const difference = original.find(
    (item) =>
      modified.find((other) => other.id === item.id)?.html !== item.html,
  );
  expect(difference).toBeDefined();
  await top
    .locator('g[data-id="' + difference!.id + '"] rect')
    .click({ force: true });
}

// Follow clear aisles through the real continuous keyboard controls.
export async function kitchenWalk(
  page: Page,
  seat: number,
  x: number,
  y: number,
) {
  const chef = page.locator(".chef.player-" + seat);
  for (const [axis, target] of [
    ["x", x],
    ["y", y],
  ] as const) {
    const before = Number(await chef.getAttribute("data-" + axis)),
      delta = target - before;
    if (Math.abs(delta) < 0.15) continue;
    const key = axis === "x" ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w";
    // Arm the stop before CDP keyDown: transport latency must not add extra
    // walking time. This only releases the real key; it never changes position.
    await page.evaluate(
      ({ seat, axis, target, key, positive }) => {
        const w = window as any;
        w.kitchenWalkDone = new Promise<void>((resolve, reject) => {
          const deadline = performance.now() + 8000;
          const start = (e: KeyboardEvent) => {
            if (e.key !== key) return;
            window.removeEventListener("keydown", start);
            const check = () => {
              const chef = document.querySelector(".chef.player-" + seat)!;
              const value = Number(chef.getAttribute("data-" + axis));
              if (
                (positive
                  ? value >= target - 0.035
                  : value <= target + 0.035) ||
                performance.now() > deadline
              ) {
                window.dispatchEvent(
                  new KeyboardEvent("keyup", { key, bubbles: true }),
                );
                if (Math.abs(value - target) > 0.25)
                  reject(
                    new Error(
                      `Kitchen walk blocked: ${axis}=${value}, target=${target}`,
                    ),
                  );
                else resolve();
              } else requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
          };
          window.addEventListener("keydown", start);
        });
      },
      { seat, axis, target, key, positive: delta > 0 },
    );
    await page.keyboard.down(key);
    try {
      await page.evaluate(() => (window as any).kitchenWalkDone);
    } finally {
      await page.keyboard.up(key);
    }
  }
  await page.waitForTimeout(150);
}

export async function jump(page: Page, heldMs?: number) {
  const button = page.getByRole("button", {
    name: "按住蓄力 · 松开起跳",
    exact: true,
  });
  await expect(button).toBeEnabled();
  const distance = Number(
    await page.getByTestId("jump-platform-0").getAttribute("data-distance"),
  );
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(heldMs ?? distance * 4);
  await page.mouse.up();
}
