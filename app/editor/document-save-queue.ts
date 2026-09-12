import type { EditorDocument } from './types';

export type DocumentSaveState = 'saved' | 'saving' | 'error';

/** Serial persistence with revision-aware presentation. A late older write may
 * finish, but can never label newer edits Saved. The caller retains writer-lock
 * admission; the existing persistence adapter retains document validation. */
export class DocumentSaveQueue {
  private ticket = 0;
  private tail: Promise<void> = Promise.resolve();
  private state: DocumentSaveState = 'saved';
  private loadFailed = false;
  private replacing = false;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly persist: (document: EditorDocument) => Promise<void>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  invalidate() { this.ticket++; this.publish(this.loadFailed ? 'error' : 'saving'); return this.ticket; }
  ensureTicket() { return this.ticket || ++this.ticket; }
  reportLoadFailure() { this.loadFailed = true; this.ticket++; this.publish('error'); }
  /** Only a confirmed new project or validated backup replacement may clear
   * a failed-load barrier. Ordinary edits, autosave and retries cannot. */
  allowConfirmedReplacement() { this.loadFailed = false; this.invalidate(); }

  save(document: EditorDocument, expectedTicket?: number): Promise<void> {
    if (this.replacing) {
      const rejected = Promise.reject<void>(new Error('Project replacement is in progress.'));
      void rejected.catch(() => undefined); return rejected;
    }
    const ticket = expectedTicket ?? ++this.ticket;
    if (ticket !== this.ticket) return Promise.resolve();
    if (this.loadFailed) {
      const rejected = Promise.reject<void>(new Error('The saved project could not be loaded. Restore a backup or confirm a new project before saving.'));
      // Background flushes need not consume the error; awaited callers still
      // receive it. The visible error state stays owned by this queue.
      void rejected.catch(() => undefined);
      return rejected;
    }
    // Capture now, not when a previous asynchronous write finally completes.
    // Subsequent edits to a caller-owned object cannot change queued bytes.
    const snapshot = structuredClone(document);
    this.publish('saving');
    const saved = this.tail.catch(() => undefined).then(() => this.persist(snapshot));
    this.tail = saved;
    void saved.then(
      () => { if (ticket === this.ticket) this.publish('saved'); },
      () => { if (ticket === this.ticket) this.publish('error'); },
    );
    return saved;
  }
  async replace(document: EditorDocument, persist: (document: EditorDocument) => Promise<void>, assertCurrent: () => void) {
    if (this.replacing) throw Error('Project replacement is already in progress.');
    const snapshot = structuredClone(document);
    this.replacing = true; this.ticket++; this.publish('saving');
    try {
      await this.tail.catch(() => undefined);
      assertCurrent();
      await persist(snapshot);
      this.loadFailed = false; this.publish('saved');
    } catch (error) { this.publish('error'); throw error; }
    finally { this.replacing = false; }
  }
  private publish(state: DocumentSaveState) {
    if (this.state === state) return;
    this.state = state; for (const listener of this.listeners) listener();
  }
}
