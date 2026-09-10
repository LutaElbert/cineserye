'use client';
import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

/** Modified wheel/pinch is a canvas gesture even above an editable, scrollable node. */
export function CanvasZoomGestures() {
  const marker = useRef<HTMLSpanElement>(null);
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const canvas = marker.current?.closest<HTMLElement>('.react-flow');
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const viewport = getViewport();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const zoom = Math.max(0.15, Math.min(4, viewport.zoom * Math.pow(2, -Math.max(-100, Math.min(100, delta)) * 0.01)));
      const ratio = zoom / viewport.zoom;
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      void setViewport({ zoom, x: x - (x - viewport.x) * ratio, y: y - (y - viewport.y) * ratio });
    };
    canvas.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => canvas.removeEventListener('wheel', wheel, true);
  }, [getViewport, setViewport]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
