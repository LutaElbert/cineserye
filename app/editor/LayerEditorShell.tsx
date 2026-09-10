'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function LayerEditorShell({ nodeId, title, onClose, children }: {
  nodeId: string; title: string; onClose: () => void; children: ReactNode;
}) {
  const container = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = container.current!;
    // Focus once per opened node, not on edits or geometry changes. The parent
    // owns the actual React Flow node dimensions and restores focus on close.
    (element.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
      ?? element.querySelector<HTMLElement>('button:not(:disabled)')
      ?? element).focus({ preventScroll: true });
  }, [nodeId]);
  return <section ref={container} tabIndex={-1} role="region" className="layer-editor-shell" aria-label={`${title} layer editor`}
    onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); }
      event.stopPropagation();
    }}>
    <header className="layer-editor-heading layer-drag-handle"><div><span className="eyebrow">Edit layer</span><h2>{title}</h2></div>
      <button type="button" className="nodrag nopan" aria-label="Close layer editor" onClick={onClose}>×</button></header>
    <div className="layer-editor-content nodrag nopan nowheel">{children}</div>
    <footer className="layer-editor-footer nodrag nopan nowheel"><small>Done / Esc keeps your draft. No generation on open.</small>
      <button type="button" className="primary-button" onClick={onClose}>Done</button></footer>
  </section>;
}
