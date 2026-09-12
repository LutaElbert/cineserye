export type ScreenBox = { left: number; top: number; width: number; height: number };

/** View-only offset. Never pan the camera or alter saved node geometry. */
export function actionbarOffset(bar: ScreenBox, canvas: ScreenBox, inset = 8) {
  const left = canvas.left + inset, top = canvas.top + inset;
  const maxLeft = Math.max(left, canvas.left + canvas.width - inset - bar.width);
  const maxTop = Math.max(top, canvas.top + canvas.height - inset - bar.height);
  return { x: Math.min(maxLeft, Math.max(left, bar.left)) - bar.left,
    y: Math.min(maxTop, Math.max(top, bar.top)) - bar.top };
}
