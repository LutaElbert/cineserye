'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { actionbarOffset } from './actionbar-bounds';

/** XYFlow anchors toolbars to nodes, but does not contain them in the canvas.
 * Translate only the actionbar so side panels cannot cover its real buttons. */
export function CanvasBoundActionbar(props: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const anchor = bar?.closest('.react-flow__node-toolbar');
    const canvas = bar?.closest('.react-flow');
    if (!bar || !anchor || !canvas) return;
    let offset = { x: 0, y: 0 };
    let pressedAt: { left: number; top: number } | null = null;
    let pressedPointer: number | null = null;
    let releaseFrame = 0;
    const update = () => {
      const bounds = canvas.getBoundingClientRect();
      bar.style.maxWidth = `${Math.max(1, bounds.width - 16)}px`;
      bar.style.maxHeight = `${Math.max(1, bounds.height - 16)}px`;
      const measured = bar.getBoundingClientRect();
      const unshifted = { left: measured.left - offset.x, top: measured.top - offset.y,
        width: measured.width, height: measured.height };
      const target = pressedAt ? { ...unshifted, ...pressedAt } : unshifted;
      const constrained = actionbarOffset(target, bounds);
      offset = { x: target.left + constrained.x - unshifted.left, y: target.top + constrained.y - unshifted.top };
      bar.style.translate = `${offset.x}px ${offset.y}px`;
    };
    const press = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cancelAnimationFrame(releaseFrame);
      const { left, top } = bar.getBoundingClientRect();
      pressedAt = { left, top };
      pressedPointer = event.pointerId;
    };
    const release = () => { pressedAt = null; pressedPointer = null; update(); };
    // Keep the target still until the browser has delivered its native click.
    // Do not capture the pointer or activate on press: release outside cancels.
    const afterRelease = (event: PointerEvent) => {
      if (event.pointerId !== pressedPointer) return;
      cancelAnimationFrame(releaseFrame); releaseFrame = requestAnimationFrame(release);
    };
    const cancelPress = (event: PointerEvent) => { if (event.pointerId === pressedPointer) release(); };
    const resize = new ResizeObserver(update);
    resize.observe(canvas); resize.observe(bar);
    const movement = new MutationObserver(update);
    movement.observe(anchor, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', update);
    bar.addEventListener('pointerdown', press, true);
    window.addEventListener('pointerup', afterRelease);
    window.addEventListener('pointercancel', cancelPress);
    window.addEventListener('blur', release);
    update();
    return () => {
      cancelAnimationFrame(releaseFrame);
      resize.disconnect(); movement.disconnect(); window.removeEventListener('resize', update);
      bar.removeEventListener('pointerdown', press, true);
      window.removeEventListener('pointerup', afterRelease);
      window.removeEventListener('pointercancel', cancelPress);
      window.removeEventListener('blur', release);
    };
  }, []);
  return <div {...props} ref={ref} style={{ ...props.style, boxSizing: 'border-box', flexWrap: 'wrap', overflow: 'auto' }} />;
}
