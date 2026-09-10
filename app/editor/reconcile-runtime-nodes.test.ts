import { expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { validateEditorDocument } from './document-file';
import { reconcileRuntimeNodes } from './reconcile-runtime-nodes';

it('retains runtime measurements across validation without changing persisted schema', () => {
  const document = structuredClone(initialDocument);
  document.nodes[0].measured = { width: 280, height: 140 };
  const parsed = validateEditorDocument(document);
  expect(parsed.nodes[0].measured).toBeUndefined();
  const live = reconcileRuntimeNodes(parsed.nodes, document.nodes);
  expect(live[0].measured).toEqual({ width: 280, height: 140 });
  expect(validateEditorDocument({ ...document, nodes: live }).nodes[0].measured).toBeUndefined();
});

it('does not transfer measurements to resized or new nodes', () => {
  const old = structuredClone(initialDocument.nodes);
  old[0].measured = { width: 280, height: 140 };
  const next = validateEditorDocument(initialDocument).nodes;
  next[0].style = { ...next[0].style, width: 600 };
  expect(reconcileRuntimeNodes(next, old)[0].measured).toBeUndefined();
  next[0].id = 'new-node';
  expect(reconcileRuntimeNodes(next, old)[0].measured).toBeUndefined();
});
