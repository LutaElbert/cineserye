import type { CinemaProjectData } from '../domain/cinema/project-data';
import { restoreStoryHistory } from './story-history-safety';
import type { EditorDocument, EditorEdge, EditorNode } from './types';

export type EditorSnapshot = Pick<EditorDocument, 'nodes' | 'edges' | 'cinema'> & { title?: string };
export type HistoryState = { canUndo: boolean; canRedo: boolean };

export function cloneSnapshot(nodes: EditorNode[], edges: EditorEdge[], cinema?: CinemaProjectData, title?: string): EditorSnapshot {
  return structuredClone({ nodes, edges, ...(cinema === undefined ? {} : { cinema }), ...(title === undefined ? {} : { title }) });
}

function estimateSnapshotBytes(snapshot: EditorSnapshot) {
  let characters = snapshot.edges.length * 280 + snapshot.nodes.length * 360
    + (snapshot.cinema ? JSON.stringify(snapshot.cinema).length : 0);
  for (const node of snapshot.nodes) {
    characters += node.data.name.length;
    if (node.data.kind === 'raster') characters += node.data.src.length;
    if (node.data.kind === 'concept') characters += node.data.label.length + node.data.eyebrow.length + JSON.stringify(node.data.body).length;
    if (node.data.kind === 'vector') for (const path of node.data.paths) {
      characters += path.d.length + path.name.length + path.fill.length + path.stroke.length;
    }
  }
  return characters * 2;
}

/** One owner for reversible snapshots. Does not own React selection, saving or
 * provider jobs. Memory roots remain available to transactional media cleanup.
 * The established 40-entry / 48 MiB estimate policy is unchanged. */
export class DocumentHistory {
  private past: EditorSnapshot[] = [];
  private future: EditorSnapshot[] = [];
  private state: HistoryState = { canUndo: false, canRedo: false };
  private readonly listeners = new Set<() => void>();
  constructor(private readonly maxEntries = 40, private readonly maxBytes = 48 * 1024 * 1024) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  roots(): readonly EditorSnapshot[] { return [...this.past, ...this.future]; }

  record(snapshot: EditorSnapshot) {
    this.past.push(cloneSnapshot(snapshot.nodes, snapshot.edges, snapshot.cinema, snapshot.title));
    this.trim(this.past); this.future = []; this.publish();
  }
  clear() { this.past = []; this.future = []; this.publish(); }
  undo(current: EditorSnapshot) { return this.move(this.past, this.future, current); }
  redo(current: EditorSnapshot) { return this.move(this.future, this.past, current); }

  private move(from: EditorSnapshot[], to: EditorSnapshot[], current: EditorSnapshot): EditorSnapshot | null {
    const target = from.at(-1);
    if (!target) return null;
    // Finish restoration and cloning before touching either stack. A rejected
    // operation boundary or non-cloneable input cannot destroy undo/redo roots.
    const restored = { ...target, cinema: restoreStoryHistory(current.cinema, target.cinema) };
    const previous = cloneSnapshot(current.nodes, current.edges, current.cinema, current.title);
    from.pop(); to.push(previous); this.trim(to); this.publish();
    return restored;
  }
  private trim(history: EditorSnapshot[]) {
    let bytes = history.reduce((sum, snapshot) => sum + estimateSnapshotBytes(snapshot), 0);
    while (history.length > this.maxEntries || (history.length > 1 && bytes > this.maxBytes)) {
      bytes -= estimateSnapshotBytes(history.shift()!);
    }
  }
  private publish() {
    const next = { canUndo: this.past.length > 0, canRedo: this.future.length > 0 };
    if (next.canUndo === this.state.canUndo && next.canRedo === this.state.canRedo) return;
    this.state = next; for (const listener of this.listeners) listener();
  }
}
