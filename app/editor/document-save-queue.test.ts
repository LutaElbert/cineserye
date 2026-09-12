import { describe, expect, it, vi } from 'vitest';
import { DocumentSaveQueue } from './document-save-queue';
import { initialDocument } from './initial-document';

const document = (title: string) => ({ ...structuredClone(initialDocument), title });
function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('document save queue characterization', () => {
  it('preserves a failed-load barrier through edits, retries and late success until explicit replacement', async () => {
    const first = deferred();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = new DocumentSaveQueue(write);
    const old = queue.save(document('older'));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    queue.reportLoadFailure(); queue.invalidate();
    first.resolve(); await old;
    expect(queue.getSnapshot()).toBe('error');
    await expect(queue.save(document('starter'))).rejects.toThrow('Restore a backup');
    expect(write).toHaveBeenCalledTimes(1);
    queue.allowConfirmedReplacement();
    await queue.save(document('confirmed replacement'));
    expect(write).toHaveBeenCalledTimes(2); expect(queue.getSnapshot()).toBe('saved');
  });
  it('does not show Saved before durable success', async () => {
    const write = deferred(); const queue = new DocumentSaveQueue(() => write.promise);
    const saved = queue.save(document('draft'));
    expect(queue.getSnapshot()).toBe('saving');
    write.resolve(); await saved;
    expect(queue.getSnapshot()).toBe('saved');
  });
  it('serializes writes and never lets an older completion mark new edits Saved', async () => {
    const first = deferred(), second = deferred();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const queue = new DocumentSaveQueue(write);
    const a = queue.save(document('a')); const b = queue.save(document('b'));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    first.resolve(); await a;
    expect(queue.getSnapshot()).toBe('saving');
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    second.resolve(); await b;
    expect(queue.getSnapshot()).toBe('saved');
    expect(write.mock.calls.map(([value]) => value.title)).toEqual(['a', 'b']);
  });
  it('invalidates an old debounce ticket without writing or overriding dirty state', async () => {
    const write = vi.fn(async () => {}); const queue = new DocumentSaveQueue(write);
    const old = queue.invalidate(); queue.invalidate();
    await queue.save(document('old'), old);
    expect(write).not.toHaveBeenCalled(); expect(queue.getSnapshot()).toBe('saving');
    await queue.save(document('current'), queue.ensureTicket());
    expect(write).toHaveBeenCalledTimes(1); expect(queue.getSnapshot()).toBe('saved');
  });
  it('keeps newer edits dirty when an in-flight older save succeeds', async () => {
    const write = deferred(); const queue = new DocumentSaveQueue(() => write.promise);
    const saved = queue.save(document('a')); queue.invalidate();
    write.resolve(); await saved;
    expect(queue.getSnapshot()).toBe('saving');
  });
  it('propagates current quota failures but allows a subsequent explicit save', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')).mockResolvedValueOnce(undefined);
    const queue = new DocumentSaveQueue(write);
    await expect(queue.save(document('unsaved'))).rejects.toThrow('Quota exceeded');
    expect(queue.getSnapshot()).toBe('error');
    await queue.save(document('retry')); expect(queue.getSnapshot()).toBe('saved');
  });
  it('does not let a stale failure override the newest saving state', async () => {
    const first = deferred(); const write = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(undefined);
    const queue = new DocumentSaveQueue(write); const a = queue.save(document('a'));
    const failure = expect(a).rejects.toThrow('old error'); const b = queue.save(document('b'));
    first.reject(new Error('old error')); await failure;
    expect(queue.getSnapshot()).not.toBe('error'); await b; expect(queue.getSnapshot()).toBe('saved');
  });
  it('captures queued content and detaches observers without cancelling persistence', async () => {
    const wait = deferred(); const write = vi.fn<(value: ReturnType<typeof document>) => Promise<void>>(() => wait.promise); const queue = new DocumentSaveQueue(write);
    const observer = vi.fn(); const unsubscribe = queue.subscribe(observer);
    const source = document('captured'); const saved = queue.save(source); source.title = 'later';
    unsubscribe(); await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.calls[0][0].title).toBe('captured');
    wait.resolve(); await saved; expect(observer).toHaveBeenCalledTimes(1);
  });
});
