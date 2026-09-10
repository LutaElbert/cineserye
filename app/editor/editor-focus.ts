export type EditorFocusSpace = { width: number; height: number; top: number; bottom: number };

/** Edit Focus favors readable text and internal scrolling; graph Fit is separate. */
export function editorFocusGeometry(space: EditorFocusSpace, width: number, preferredHeight: number) {
  // Reflow the real node on narrow screens instead of shrinking form text.
  width = Math.min(width, Math.max(280, space.width - 32));
  const availableHeight = Math.max(80, space.height - space.top - space.bottom);
  const widthZoom = Math.max(0.15, Math.min(1, (space.width - 32) / width));
  const height = Math.round(Math.min(preferredHeight, Math.max(Math.min(220, preferredHeight), availableHeight / widthZoom)));
  const zoom = Math.max(0.15, Math.min(widthZoom, availableHeight / height));
  return { width, height, zoom, centerOffsetY: (space.bottom - space.top) / (2 * zoom) };
}
