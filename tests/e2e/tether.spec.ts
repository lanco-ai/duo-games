import { test, expect } from "@playwright/test";

test("tether endpoints remain inside both characters throughout the animation", async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const pair = page.locator(".hero-couple .tethered-pair");
    await expect(pair).toBeVisible();
    const samples = await pair.evaluate((element) => {
      const svg = element as SVGSVGElement;
      const rope = svg.querySelector(".pair-thread path") as SVGPathElement;
      return [0, 120, 420, 720, 1500, 6000].map((time) => {
        for (const animation of svg.getAnimations()) {
          animation.pause();
          animation.currentTime = time;
        }
        return [0, 1].map((seat) => {
          const point = rope.getPointAtLength(seat ? rope.getTotalLength() : 0).matrixTransform(rope.getScreenCTM()!);
          return [...svg.querySelectorAll(`[data-pair-seat="${seat}"] path`)].some((el) => {
            const path = el as SVGPathElement;
            if (path.getAttribute("fill") === "none" || path.hasAttribute("opacity")) return false;
            return path.isPointInFill(point.matrixTransform(path.getScreenCTM()!.inverse()));
          });
        });
      });
    });
    expect(samples).toEqual(Array.from({ length: 6 }, () => [true, true]));
  }
});
