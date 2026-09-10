import type { EditorNode } from './types';

/** Domain validation strips measurements. Retain them in the live view, not the file schema. */
export function reconcileRuntimeNodes(next: EditorNode[], current: EditorNode[]): EditorNode[] {
  const previous = new Map(current.map((node) => [node.id, node]));
  return next.map((node) => {
    const old = previous.get(node.id);
    if (!old || old.type !== node.type || old.style?.width !== node.style?.width || old.style?.height !== node.style?.height) return node;
    // Existing dimensions are a starting point; ResizeObserver still updates changed content.
    return { ...node, measured: old.measured, width: old.width, height: old.height };
  });
}
