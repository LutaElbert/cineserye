// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CanvasBoundActionbar } from './CanvasBoundActionbar';
import { createElement } from 'react';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  let anchorLeft = 100;
  let update!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.stubGlobal('MutationObserver', class { constructor(callback: () => void) { update = callback; } observe() {} disconnect = disconnect; });
  const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const bar = this.classList.contains('node-actionbar');
    const left = bar ? anchorLeft + (parseFloat(this.style.translate) || 0) : 0;
    const top = bar ? (parseFloat(this.style.translate.split(' ')[1]) || 0) : 0;
    return { left, top, x: left, y: top, width: bar ? 300 : 1000, height: bar ? 40 : 800, right: left + (bar ? 300 : 1000), bottom: top + (bar ? 40 : 800), toJSON() {} };
  });
  const view = render(createElement('div', { className: 'react-flow' }, createElement('div', { className: 'react-flow__node-toolbar' },
    createElement(CanvasBoundActionbar, { className: 'node-actionbar' }, createElement('button', {}, 'Add next scene')))));
  const bar = view.container.querySelector<HTMLElement>('.node-actionbar')!;
  const pointer = (target: EventTarget, type: string, id = 1, primary = true) => act(() => {
    const event = new MouseEvent(type, { bubbles: true, button: 0 });
    Object.defineProperties(event, { pointerId: { value: id }, isPrimary: { value: primary } });
    target.dispatchEvent(event);
  });
  return { ...view, bar, frames, disconnect, pointer,
    move: () => act(() => { anchorLeft += 100; update(); }),
    flush: () => act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); }),
  };
}

it('holds a primary press through native release, then follows its anchor', () => {
  const t = setup(); t.pointer(t.bar, 'pointerdown'); t.move();
  expect(t.bar.style.translate).toBe('-100px 8px');
  t.pointer(window, 'pointerup');
  expect(t.bar.style.translate).toBe('-100px 8px');
  t.flush(); expect(t.bar.style.translate).toBe('0px 8px');
});

it('ignores unrelated pointers and releases matching cancellation', () => {
  const t = setup(); t.pointer(t.bar, 'pointerdown'); t.move();
  t.pointer(window, 'pointerup', 2, false); t.pointer(window, 'pointercancel', 2, false);
  expect(t.frames.size).toBe(0); expect(t.bar.style.translate).toBe('-100px 8px');
  t.pointer(window, 'pointercancel'); expect(t.bar.style.translate).toBe('0px 8px');
});

it('releases on window blur and does not freeze for a secondary touch', () => {
  const t = setup(); t.pointer(t.bar, 'pointerdown', 2, false); t.move();
  expect(t.bar.style.translate).toBe('0px 8px');
  t.pointer(t.bar, 'pointerdown'); t.move();
  expect(t.bar.style.translate).toBe('-100px 8px');
  act(() => window.dispatchEvent(new Event('blur')));
  expect(t.bar.style.translate).toBe('0px 8px');
});

it('cleans up observers, pending frames and window listeners on unmount', () => {
  const remove = vi.spyOn(window, 'removeEventListener');
  const t = setup(); t.pointer(t.bar, 'pointerdown'); t.pointer(window, 'pointerup');
  expect(t.frames.size).toBe(1); t.unmount();
  expect(t.frames.size).toBe(0); expect(t.disconnect).toHaveBeenCalledTimes(2);
  for (const type of ['resize', 'pointerup', 'pointercancel', 'blur']) expect(remove.mock.calls.some(([event]) => event === type)).toBe(true);
});
