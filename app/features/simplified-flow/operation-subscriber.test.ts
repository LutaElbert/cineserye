import { afterEach, expect, it, vi } from 'vitest';
import { subscribeToOperation } from './operation-subscriber';
afterEach(() => vi.useRealTimers());
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

it('serializes the read and asynchronous artifact application before polling again', async () => {
  vi.useFakeTimers();
  const readGate = deferred<number>(), applyGate = deferred<boolean>();
  const read = vi.fn().mockReturnValueOnce(readGate.promise).mockResolvedValue(2);
  const apply = vi.fn().mockReturnValueOnce(applyGate.promise).mockResolvedValue(true);
  const stop = subscribeToOperation({ read, apply, onError: vi.fn(), intervalMs: 100 });
  await vi.advanceTimersByTimeAsync(5000); expect(read).toHaveBeenCalledTimes(1);
  readGate.resolve(1); await vi.advanceTimersByTimeAsync(5000); expect(apply).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
  applyGate.resolve(false); await vi.advanceTimersByTimeAsync(100); expect(read).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(5000); expect(read).toHaveBeenCalledTimes(2); stop();
});
it('ignores a disposed read even if transport ignores abort', async () => {
  const gate = deferred<number>(), apply = vi.fn(), onError = vi.fn(); let signal!: AbortSignal;
  const stop = subscribeToOperation({ read: value => { signal = value; return gate.promise; }, apply, onError });
  stop(); expect(signal.aborted).toBe(true); gate.resolve(1); await Promise.resolve();
  expect(apply).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
});
it('invalidates work already awaiting artifact persistence when disposed', async () => {
  const gate = deferred<boolean>(); let isCurrent!: () => boolean;
  const stop = subscribeToOperation({ read: async () => 1, apply: async (_value, guard) => { isCurrent = guard; return gate.promise; }, onError: vi.fn() });
  await Promise.resolve(); expect(isCurrent()).toBe(true); stop(); expect(isCurrent()).toBe(false); gate.resolve(false);
});
it('reports connection failures with bounded backoff and never submits a request', async () => {
  vi.useFakeTimers(); const read = vi.fn().mockRejectedValue(Error('offline')), onError = vi.fn();
  const stop = subscribeToOperation({ read, apply: vi.fn(), onError, intervalMs: 100, maximumBackoffMs: 400 });
  await vi.advanceTimersByTimeAsync(0); expect(onError).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(199); expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(read).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(400); expect(read).toHaveBeenCalledTimes(3); stop();
});
