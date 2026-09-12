import { expect, it } from 'vitest';
import { actionbarOffset } from './actionbar-bounds';

const canvas = { left: 280, top: 64, width: 660, height: 656 };
it('leaves an already reachable toolbar unchanged', () => {
  expect(actionbarOffset({ left: 350, top: 200, width: 400, height: 42 }, canvas)).toEqual({ x: 0, y: 0 });
});
it('keeps a right-edge toolbar outside the Properties overlay', () => {
  expect(actionbarOffset({ left: 742, top: 350, width: 430, height: 42 }, canvas)).toEqual({ x: -240, y: 0 });
});
it('also handles left/top clipping and small canvases without changing inputs', () => {
  const bar = { left: 100, top: 30, width: 430, height: 42 };
  expect(actionbarOffset(bar, canvas)).toEqual({ x: 188, y: 42 });
  expect(actionbarOffset(bar, { left: 0, top: 0, width: 100, height: 40 })).toEqual({ x: -92, y: -22 });
  expect(bar).toEqual({ left: 100, top: 30, width: 430, height: 42 });
});
