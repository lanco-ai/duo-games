import { afterEach, expect, it, vi } from "vitest";
import { canvasPoint } from "../../web/src/games/canvas-point";

afterEach(() => vi.unstubAllGlobals());
function board(
  style: Record<string, string>,
  rect: { width: number; height: number },
) {
  vi.stubGlobal("getComputedStyle", () => ({
    boxSizing: "border-box",
    width: "366px",
    height: "366px",
    borderLeftWidth: "10px",
    borderRightWidth: "10px",
    borderTopWidth: "10px",
    borderBottomWidth: "10px",
    paddingLeft: "0px",
    paddingRight: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    ...style,
  }));
  return {
    width: 1000,
    height: 1000,
    getBoundingClientRect: () => ({ left: 20, top: 30, ...rect }),
  } as HTMLCanvasElement;
}
it("maps the inside edges of the ten-pixel drawing frame to the full drawing", () => {
  const canvas = board({}, { width: 366, height: 366 });
  expect(canvasPoint(canvas, { clientX: 30, clientY: 40 })).toEqual({
    x: 0,
    y: 0,
  });
  expect(canvasPoint(canvas, { clientX: 376, clientY: 386 })).toEqual({
    x: 1000,
    y: 1000,
  });
  expect(canvasPoint(canvas, { clientX: 203, clientY: 213 })).toEqual({
    x: 500,
    y: 500,
  });
});
it("preserves logical coordinates under CSS scaling and a high-DPI backing store", () => {
  const canvas = board({}, { width: 183, height: 183 });
  canvas.width = canvas.height = 2000;
  expect(canvasPoint(canvas, { clientX: 25, clientY: 35 }, 1000, 1000)).toEqual(
    { x: 0, y: 0 },
  );
  expect(
    canvasPoint(canvas, { clientX: 111.5, clientY: 121.5 }, 1000, 1000),
  ).toEqual({ x: 500, y: 500 });
});
it("excludes asymmetric borders and padding for content-box canvases", () => {
  const canvas = board(
    {
      boxSizing: "content-box",
      width: "300px",
      height: "200px",
      borderLeftWidth: "4px",
      borderRightWidth: "6px",
      borderTopWidth: "2px",
      borderBottomWidth: "8px",
      paddingLeft: "10px",
      paddingRight: "20px",
      paddingTop: "12px",
      paddingBottom: "18px",
    },
    { width: 340, height: 240 },
  );
  expect(canvasPoint(canvas, { clientX: 34, clientY: 44 }, 720, 500)).toEqual({
    x: 0,
    y: 0,
  });
  expect(canvasPoint(canvas, { clientX: 334, clientY: 244 }, 720, 500)).toEqual(
    { x: 720, y: 500 },
  );
});
it("keeps positions outside the content box available for captured drags", () => {
  const canvas = board({}, { width: 366, height: 366 });
  expect(canvasPoint(canvas, { clientX: 20, clientY: 396 }).x).toBeLessThan(0);
  expect(canvasPoint(canvas, { clientX: 20, clientY: 396 }).y).toBeGreaterThan(
    1000,
  );
});
