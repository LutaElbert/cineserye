'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Lives inside the React Flow node: no portal, dialog, backdrop or viewport positioning. */
export function ExpandedPremiseNode({ nodeId, children, onClose }: { nodeId: string; children: ReactNode; onClose: () => void }) {
  const container = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = container.current!;
    (element.querySelector<HTMLElement>('input:not(:disabled)') ?? element.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }, [nodeId]);
  return <section ref={container} tabIndex={-1} role="region" aria-label="Story premise layer editor"
    className="premise-expanded-node nowheel"
    onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); }
      event.stopPropagation();
    }}>
    {children}
  </section>;
}
