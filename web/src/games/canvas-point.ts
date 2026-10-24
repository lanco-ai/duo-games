/** Map a pointer into canvas content coordinates, excluding its CSS frame. */
export function canvasPoint(
  canvas: HTMLCanvasElement,
  event: Pick<PointerEvent, "clientX" | "clientY">,
  width = canvas.width,
  height = canvas.height,
) {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const px = (value: string) => parseFloat(value) || 0;
  const left = px(style.borderLeftWidth) + px(style.paddingLeft);
  const top = px(style.borderTopWidth) + px(style.paddingTop);
  const horizontal = left + px(style.borderRightWidth) + px(style.paddingRight);
  const vertical = top + px(style.borderBottomWidth) + px(style.paddingBottom);
  const borderBox = style.boxSizing === "border-box";
  const outerWidth = px(style.width) + (borderBox ? 0 : horizontal);
  const outerHeight = px(style.height) + (borderBox ? 0 : vertical);
  return {
    x:
      ((((event.clientX - rect.left) * outerWidth) / rect.width - left) /
        Math.max(1, outerWidth - horizontal)) *
      width,
    y:
      ((((event.clientY - rect.top) * outerHeight) / rect.height - top) /
        Math.max(1, outerHeight - vertical)) *
      height,
  };
}
