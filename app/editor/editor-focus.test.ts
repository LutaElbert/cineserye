import { describe, expect, it } from 'vitest';
import { editorFocusGeometry } from './editor-focus';

describe('readable editor focus', () => {
  it('shortens the view-only form instead of shrinking desktop text', () => {
    const result = editorFocusGeometry({ width: 626, height: 495, top: 72, bottom: 74 }, 460, 680);
    expect(result.zoom).toBe(1);
    expect(result.height).toBe(349);
  });
  it('preserves the full preferred form when space permits', () => {
    expect(editorFocusGeometry({ width: 900, height: 936, top: 72, bottom: 74 }, 440, 640)).toMatchObject({ width: 440, height: 640, zoom: 1 });
  });
  it('fits narrow screens without overlapping reserved controls', () => {
    const space = { width: 390, height: 786, top: 72, bottom: 74 };
    const result = editorFocusGeometry(space, 460, 680);
    expect(result.zoom).toBeGreaterThan(0.75);
    expect(result.width * result.zoom).toBeLessThanOrEqual(space.width - 32);
    expect(result.height * result.zoom).toBeLessThanOrEqual(space.height - space.top - space.bottom);
  });
  it('keeps an internally scrollable shell in very short enlarged-browser viewports', () => {
    const result = editorFocusGeometry({ width: 500, height: 290, top: 72, bottom: 74 }, 440, 640);
    expect(result.height).toBe(220);
    expect(result.height * result.zoom).toBeCloseTo(144);
  });
});
