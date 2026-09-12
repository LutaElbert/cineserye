import { describe, expect, it, vi } from 'vitest';
import { DocumentHistory, type EditorSnapshot } from './document-history';
import { initialDocument } from './initial-document';
import { createEmptyCinemaProjectData } from '../domain/cinema/project-data';
import { emptyStoryWorkflow } from '../domain/cinema/story-workflow';

function snapshot(name: string): EditorSnapshot {
  const value = structuredClone(initialDocument);
  value.nodes[0].data.name = name;
  return { nodes: value.nodes, edges: value.edges, cinema: value.cinema };
}

describe('document history characterization', () => {
  it('records one atomic batch and restores exact graph geometry/domain identity through undo/redo', () => {
    const history = new DocumentHistory(); const before = snapshot('before'); const after = snapshot('after');
    after.nodes[0].position = { x: 900, y: -500 };
    history.record(before);
    expect(history.getSnapshot()).toEqual({ canUndo: true, canRedo: false });
    expect(history.undo(after)).toEqual(before);
    expect(history.getSnapshot()).toEqual({ canUndo: false, canRedo: true });
    expect(history.redo(before)).toEqual(after);
    expect(history.getSnapshot()).toEqual({ canUndo: true, canRedo: false });
    expect(history.redo(after)).toBeNull();
  });
  it('owns captured snapshots and keeps both history directions reachable until explicit clear', () => {
    const history = new DocumentHistory(); const before = snapshot('before'); const after = snapshot('after');
    history.record(before); before.nodes[0].data.name = 'mutated outside history';
    expect(history.roots()[0].nodes[0].data.name).toBe('before');
    const restored = history.undo(after)!;
    expect(history.roots()).toEqual([after]);
    expect(history.redo(restored)).toEqual(after);
    expect(history.roots()[0].nodes[0].data.name).toBe('before');
    history.clear(); expect(history.roots()).toEqual([]);
    expect(history.getSnapshot()).toEqual({ canUndo: false, canRedo: false });
  });
  it('a new edit drops redo only, retaining prior undo roots', () => {
    const history = new DocumentHistory(); const a = snapshot('a'), b = snapshot('b'), c = snapshot('c');
    history.record(a); history.record(b); history.undo(c); history.record(b);
    expect(history.getSnapshot()).toEqual({ canUndo: true, canRedo: false });
    expect(history.roots()).toEqual([a, b]);
  });
  it('keeps existing entry and memory-budget trimming, including one oversized recovery snapshot', () => {
    const capped = new DocumentHistory(2);
    for (const name of ['a', 'b', 'c']) capped.record(snapshot(name));
    expect(capped.roots().map((item) => item.nodes[0].data.name)).toEqual(['b', 'c']);
    const limited = new DocumentHistory(40, 1);
    limited.record(snapshot('a')); limited.record(snapshot('b'));
    expect(limited.roots().map((item) => item.nodes[0].data.name)).toEqual(['b']);
  });
  it('rejects crossing an unresolved request without changing stacks, roots or notifications', () => {
    const history = new DocumentHistory(); const before = snapshot('before'); const current = snapshot('running');
    current.cinema = createEmptyCinemaProjectData('project'); current.cinema.storyWorkflow = emptyStoryWorkflow();
    current.cinema.storyWorkflow.sessions.push({ id: 'session', operationId: 'operation', mode: 'expand', anchorSceneId: null,
      stage: 'outcome-unknown', source: { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: 0, references: [] },
      proposals: [], accepted: [], error: 'Disconnected' });
    history.record(before); const roots = history.roots(); const state = history.getSnapshot();
    const notify = vi.fn(); const unsubscribe = history.subscribe(notify);
    expect(() => history.undo(current)).toThrow(/existing Story request/);
    expect(history.roots()).toEqual(roots); expect(history.getSnapshot()).toBe(state);
    expect(notify).not.toHaveBeenCalled(); unsubscribe();
  });
});
