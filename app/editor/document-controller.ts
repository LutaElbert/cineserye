import { removeCinemaRecordsForNodes, type CinemaProjectData } from '../domain/cinema/project-data';
import { validateEditorDocument } from './document-file';
import { DocumentHistory, cloneSnapshot, type EditorSnapshot } from './document-history';
import { DocumentSaveQueue } from './document-save-queue';
import { reconcileRuntimeNodes } from './reconcile-runtime-nodes';
import type { EditorDocument, EditorEdge, EditorNode } from './types';

type Content = Pick<EditorDocument, 'title' | 'nodes' | 'edges' | 'cinema'>;
type Snapshot = Content & { revision: number; replacing: boolean };
type Update<T> = T | ((current: T) => T);
export type DocumentSource = { revision: number; epoch: number };
const transient = new Set(['selected', 'dragging', 'measured', 'resizing']);
function elementEqual(a: EditorNode | EditorEdge, b: EditorNode | EditorEdge) {
  const left = a as unknown as Record<string, unknown>, right = b as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key => transient.has(key) || Object.is(left[key], right[key]));
}
function contentEqual(a: Content, b: Content) {
  return a.title === b.title && a.cinema === b.cinema && a.nodes.length === b.nodes.length && a.edges.length === b.edges.length
    && a.nodes.every((n, i) => elementEqual(n, b.nodes[i])) && a.edges.every((e, i) => elementEqual(e, b.edges[i]));
}

/** The sole in-memory document owner. React reads snapshots; event handlers read
 * the same current value. Field adapters support existing trusted canvas gestures;
 * completed domain batches, restores and persistence validate the full document.
 * Session selection/measurements neither advance source revision nor dirty saves.
 * History gesture roots remain owned by DocumentHistory, not another document. */
export class DocumentController {
  private state: Snapshot;
  private epoch = 0;
  private writable = false;
  private active = true;
  private listeners = new Set<() => void>();
  readonly history = new DocumentHistory();
  readonly saves: DocumentSaveQueue;
  constructor(initial: EditorDocument, persist: (document: EditorDocument, assertWritable: () => void) => Promise<void>) {
    this.state = { ...structuredClone(initial), revision: 0, replacing: false };
    this.saves = new DocumentSaveQueue(document => { this.assertWriter(); return persist(document, () => this.assertWriter()); });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setAdmission(writable: boolean, active = true) { this.writable = writable; this.active = active; }
  private assertWriter() { if (!this.active || !this.writable) throw Error('This document is not writable. Wait for loading or close the other editor and reload.'); }
  private assertEditable() { this.assertWriter(); if (this.state.replacing) throw Error('Project replacement is in progress. Wait before editing.'); }
  capture = (): DocumentSource => ({ revision: this.state.revision, epoch: this.epoch });
  ownsProject = (epoch: number, projectId: string | undefined) => this.active && this.writable && !this.state.replacing
    && epoch === this.epoch && projectId === this.state.cinema?.projectId;
  assertSource = (source: DocumentSource) => {
    this.assertWriter();
    if (source.revision !== this.state.revision || source.epoch !== this.epoch) throw Error('The project changed. Review the current project before replacing it.');
  };
  document = (): EditorDocument => ({ schemaVersion: 5, title: this.state.title,
    nodes: this.state.nodes.map(n => ({ ...n, selected: false })), edges: this.state.edges.map(e => ({ ...e, selected: false })),
    ...(this.state.cinema === undefined ? {} : { cinema: this.state.cinema }), updatedAt: Date.now() });
  private publish(next: Snapshot) { this.state = next; for (const listener of this.listeners) listener(); }
  private apply(content: Content, dirty = true) {
    const changed = !contentEqual(this.state, content);
    if (changed && dirty) this.saves.invalidate();
    this.publish({ ...content, revision: this.state.revision + Number(changed), replacing: this.state.replacing });
  }
  private edit<K extends keyof Content>(key: K, update: Update<Content[K]>) {
    const value = typeof update === 'function' ? (update as (current: Content[K]) => Content[K])(this.state[key]) : update;
    if (value === this.state[key]) return;
    const next = { ...this.state, [key]: value };
    // Read-only tabs still support selection and renderer measurements.
    if (!contentEqual(this.state, next)) {
      if (!this.active || !this.writable || this.state.replacing) return;
    }
    this.apply(next);
  }
  setNodes = (value: Update<EditorNode[]>) => this.edit('nodes', value);
  setEdges = (value: Update<EditorEdge[]>) => this.edit('edges', value);
  setCinema = (value: Update<CinemaProjectData | undefined>) => this.edit('cinema', value);
  setTitle = (value: Update<string>) => this.edit('title', value);
  record = (snapshot?: EditorSnapshot) => { this.assertEditable(); this.history.record(snapshot ?? this.state); };
  commit = (document: EditorDocument, record = true) => {
    this.assertEditable();
    const next = validateEditorDocument(document, { strictGraph: true });
    if (record) this.history.record(this.state);
    this.apply({ ...next, nodes: reconcileRuntimeNodes(next.nodes, this.state.nodes) });
  };
  /** XYFlow reports incident edges and nodes separately. Commit the entire
   * user deletion before those callbacks so Undo restores one coherent graph. */
  deleteElements = (nodeIds: readonly string[], edgeIds: readonly string[]) => {
    this.assertEditable();
    const requestedNodes = new Set(nodeIds), requestedEdges = new Set(edgeIds);
    const removed = new Set(this.state.nodes.filter(node => requestedNodes.has(node.id) && !node.data.locked && node.deletable !== false).map(node => node.id));
    const nodes = this.state.nodes.filter(node => !removed.has(node.id));
    const edges = this.state.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)
      && !(requestedEdges.has(edge.id) && edge.deletable !== false));
    if (nodes.length === this.state.nodes.length && edges.length === this.state.edges.length) return false;
    const cinema = this.state.cinema && removeCinemaRecordsForNodes(this.state.cinema, removed, new Set(nodes.map(node => node.id)));
    this.commit({ ...this.document(), nodes, edges, cinema });
    return true;
  };
  moveHistory = (direction: 'undo' | 'redo') => {
    this.assertEditable(); const next = this.history[direction](this.state);
    if (next) this.apply({ ...this.state, ...next });
    return Boolean(next);
  };
  hydrate = (document: EditorDocument) => {
    if (!this.active) return;
    const next = validateEditorDocument(document); this.epoch++; this.apply(next, false);
  };
  save = (document = this.document(), ticket?: number) => {
    try { this.assertEditable(); return this.saves.save(validateEditorDocument(document, { strictGraph: true }), ticket); }
    catch (error) { const rejected = Promise.reject<void>(error); void rejected.catch(() => {}); return rejected; }
  };
  /** Locks creative edits synchronously, drains older saves, then atomically
   * persists before publishing. Failure preserves document, history and load
   * barrier. Confirmation/source checks happen before this method is called. */
  replace = async (document: EditorDocument, source: DocumentSource,
    persist: (document: EditorDocument, assertCurrent: () => void) => Promise<void>, keepHistory = false) => {
    this.assertEditable(); this.assertSource(source);
    const next = validateEditorDocument(document, { strictGraph: true });
    const previous = keepHistory ? cloneSnapshot(this.state.nodes, this.state.edges, this.state.cinema, this.state.title) : null;
    this.publish({ ...this.state, replacing: true });
    try {
      await this.saves.replace(next, value => persist(value, () => this.assertSource(source)), () => this.assertSource(source));
      // Persistence has committed. Reflect that transaction even if unmounted;
      // the detached controller has no React listeners and cannot affect a new editor.
      if (previous) this.history.record(previous); else this.history.clear();
      this.epoch++; this.apply(next, false);
    } finally { this.publish({ ...this.state, replacing: false }); }
  };
}
