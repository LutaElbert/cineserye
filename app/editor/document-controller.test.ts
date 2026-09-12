import { expect, it, vi } from 'vitest';
import { DocumentController } from './document-controller';
import { initialDocument } from './initial-document';
const doc = (title = 'Draft') => ({ ...structuredClone(initialDocument), title });
it('result ownership survives edits but not same-project replacement, replacement-in-flight or detachment', async () => {
  const { c } = controller(); const project = c.document().cinema?.projectId, epoch = c.capture().epoch;
  c.setTitle('Edited'); expect(c.ownsProject(epoch, project)).toBe(true);
  const pending = gate(); const replacing = c.replace(c.document(), c.capture(), () => pending.promise);
  expect(c.ownsProject(epoch, project)).toBe(false); pending.resolve(); await replacing;
  expect(c.ownsProject(epoch, project)).toBe(false); const current = c.capture().epoch;
  expect(c.ownsProject(current, project)).toBe(true); c.setAdmission(true, false); expect(c.ownsProject(current, project)).toBe(false);
});
function gate() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
function controller() { const persist = vi.fn(async () => {}); const c = new DocumentController(doc(), persist); c.setAdmission(true); return { c, persist }; }
it('has one synchronously readable snapshot across consecutive functional canvas edits', () => {
  const { c } = controller(); c.setTitle('First'); c.setTitle(value => value + ' second');
  expect(c.document().title).toBe('First second'); expect(c.getSnapshot().title).toBe('First second');
});
it('keeps selection and measurements out of dirty state and source revisions', () => {
  const { c } = controller(); const source = c.capture();
  c.setNodes(nodes => nodes.map(n => ({ ...n, selected: true, measured: { width: 2, height: 3 } })));
  c.assertSource(source); expect(c.saves.getSnapshot()).toBe('saved');
  expect(c.document().nodes.every(n => !n.selected)).toBe(true);
});
it('rejects invalid whole-document batches before history or source changes', () => {
  const { c } = controller(); const before = c.getSnapshot();
  expect(() => c.commit({ ...doc(), nodes: [doc().nodes[0], doc().nodes[0]] })).toThrow('duplicate layer');
  expect(c.getSnapshot()).toBe(before); expect(c.history.getSnapshot().canUndo).toBe(false);
});
it('commits one batch with one reversible history boundary', () => {
  const { c } = controller(); const before = c.document(); const next = doc(); next.nodes[0].position.x += 100;
  c.commit(next); expect(c.history.roots()).toHaveLength(1);
  c.moveHistory('undo'); expect(c.document().nodes[0].position).toEqual(before.nodes[0].position);
  c.moveHistory('redo'); expect(c.document().nodes[0].position).toEqual(next.nodes[0].position);
});
it('deletes a node and incident edges as exactly one reversible graph transaction', () => {
  const { c } = controller(); const before = c.document(), target = before.nodes.at(-1)!;
  expect(c.deleteElements([target.id], [])).toBe(true);
  expect(c.history.roots()).toHaveLength(1);
  expect(c.document().edges.every(edge => edge.source !== target.id && edge.target !== target.id)).toBe(true);
  c.moveHistory('undo'); expect(c.document().nodes).toEqual(before.nodes); expect(c.document().edges).toEqual(before.edges);
  expect(c.history.getSnapshot().canUndo).toBe(false);
  c.moveHistory('redo'); expect(c.document().nodes.some(node => node.id === target.id)).toBe(false);
});
it('edge-only deletion is atomic and missing or locked targets add no history', () => {
  const { c } = controller(); const before = c.document();
  expect(c.deleteElements([], [before.edges[0].id])).toBe(true); c.moveHistory('undo');
  expect(c.document().edges).toEqual(before.edges);
  c.history.clear(); c.setNodes(nodes => nodes.map(node => ({ ...node, data: { ...node.data, locked: true } })));
  expect(c.deleteElements(before.nodes.map(node => node.id), [])).toBe(false);
  expect(c.deleteElements(['missing'], ['missing'])).toBe(false); expect(c.history.roots()).toHaveLength(0);
  c.setAdmission(false); expect(() => c.deleteElements([], [before.edges[0].id])).toThrow('not writable');
});
it('checkpoint replacement undo restores the original title with its content', async () => {
  const { c } = controller();
  await c.replace(doc('Checkpoint'), c.capture(), async () => {}, true);
  c.moveHistory('undo'); expect(c.document().title).toBe('Draft');
  c.moveHistory('redo'); expect(c.document().title).toBe('Checkpoint');
});
it('readers and unmounted owners cannot edit, save, undo or replace', async () => {
  const { c, persist } = controller(); c.setAdmission(false);
  c.setTitle('Not allowed'); expect(c.document().title).toBe('Draft');
  expect(() => c.commit(doc())).toThrow('not writable'); expect(() => c.moveHistory('undo')).toThrow('not writable');
  await expect(c.save()).rejects.toThrow('not writable');
  await expect(c.replace(doc(), c.capture(), persist)).rejects.toThrow('not writable');
  c.setAdmission(true, false); await expect(c.save()).rejects.toThrow('not writable'); expect(persist).not.toHaveBeenCalled();
});
it('rejects a late confirmed restore after a real edit but not a selection change', async () => {
  const { c } = controller(); const source = c.capture(); c.setTitle('Newer work'); const replace = vi.fn(async () => {});
  await expect(c.replace(doc('Old backup'), source, replace)).rejects.toThrow('project changed');
  expect(replace).not.toHaveBeenCalled(); expect(c.document().title).toBe('Newer work');
});
it('drains older persistence, blocks edits and duplicate replacement, then publishes durable content', async () => {
  const old = gate(), replacement = gate(); const write = vi.fn(() => old.promise);
  const c = new DocumentController(doc(), write); c.setAdmission(true);
  const saved = c.save(); await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
  const replace = vi.fn(() => replacement.promise); const pending = c.replace(doc('Restored'), c.capture(), replace);
  c.setTitle('Blocked edit'); expect(c.document().title).toBe('Draft'); expect(c.getSnapshot().replacing).toBe(true);
  await expect(c.replace(doc(), c.capture(), replace)).rejects.toThrow('replacement');
  await expect(c.save()).rejects.toThrow('replacement'); expect(replace).not.toHaveBeenCalled();
  old.resolve(); await saved; await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
  expect(c.saves.getSnapshot()).toBe('saving'); expect(c.document().title).toBe('Draft');
  replacement.resolve(); await pending;
  expect(c.document().title).toBe('Restored'); expect(c.saves.getSnapshot()).toBe('saved'); expect(c.getSnapshot().replacing).toBe(false);
});
it('replacement failure preserves content, history and failed-load barrier', async () => {
  const { c } = controller(); const next = doc(); next.nodes[0].position.x += 10; c.commit(next);
  c.saves.reportLoadFailure(); const before = c.document(), roots = c.history.roots();
  await expect(c.replace(doc('Bad replacement'), c.capture(), async () => { throw Error('Quota'); })).rejects.toThrow('Quota');
  expect(c.document().title).toBe(before.title); expect(c.history.roots()).toEqual(roots);
  expect(c.getSnapshot().replacing).toBe(false); await expect(c.save()).rejects.toThrow('Restore a backup');
});
it('rechecks owner after older saves drain and before replacement persistence', async () => {
  const old = gate(); const write = vi.fn(() => old.promise); const c = new DocumentController(doc(), write); c.setAdmission(true);
  const saving = c.save(); await vi.waitFor(() => expect(write).toHaveBeenCalledOnce()); const replace = vi.fn(async () => {});
  const pending = c.replace(doc('Replacement'), c.capture(), replace); const rejected = expect(pending).rejects.toThrow('not writable');
  c.setAdmission(false); old.resolve(); await saving; await rejected; expect(replace).not.toHaveBeenCalled();
});
it('successful replacement clears failed-load barrier and invalidates old source tokens', async () => {
  const { c, persist } = controller(); const source = c.capture(); c.saves.reportLoadFailure();
  await c.replace(doc('Restored'), source, async () => {});
  expect(() => c.assertSource(source)).toThrow('project changed'); await c.save(); expect(persist).toHaveBeenCalledOnce();
});
it('ordinary saves recheck writer ownership after asynchronous adapter preparation', async () => {
  const ready = gate(); const stored = vi.fn(); const entered = vi.fn();
  const c = new DocumentController(doc(), async (document, assertWritable) => {
    entered(); await ready.promise; assertWritable(); stored(document);
  }); c.setAdmission(true);
  const pending = c.save(); await vi.waitFor(() => expect(entered).toHaveBeenCalledOnce());
  const rejected = expect(pending).rejects.toThrow('not writable');
  c.setAdmission(false, false); ready.resolve(); await rejected; expect(stored).not.toHaveBeenCalled();
});
