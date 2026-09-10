import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationExecutor, OperationRepository, operationDigest } from './operation-repository';

const directories: string[] = [];
const stores: OperationRepository[] = [];
afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});
async function open(path = ':memory:') {
  const store = await OperationRepository.open(path); stores.push(store); return store;
}
describe('SAFE-04/05 durable operation replay', () => {
  it('commits or rolls back synchronous multi-record dispatch fences atomically', async () => {
    const store = await open();
    expect(() => store.transaction(() => { store.claim('parent:retry', 'a'); store.claim('child', 'b'); throw Error('Failed before commit'); })).toThrow();
    expect(store.read('parent:retry')).toBeUndefined(); expect(store.read('child')).toBeUndefined();
    store.transaction(() => { store.claim('parent:retry', 'a'); store.claim('child', 'b'); store.checkpoint('child', 'b', { queued: true }); });
    expect(store.read('parent:retry')?.status).toBe('pending'); expect(store.read('child')?.result).toBe('{"queued":true}');
    expect(() => store.transaction(() => Promise.resolve('not allowed'))).toThrow(/synchronous/);
  });
  it('deduplicates simultaneous requests and rejects conflicting content', async () => {
    const executor = new OperationExecutor(await open());
    const dispatch = vi.fn(async () => ({ scenes: ['a'] }));
    const results = await Promise.all([executor.execute('story:1', { a: 1 }, dispatch), executor.execute('story:1', { a: 1 }, dispatch)]);
    expect(results[0]).toEqual(results[1]); expect(dispatch).toHaveBeenCalledTimes(1);
    await expect(executor.execute('story:1', { a: 2 }, dispatch)).rejects.toThrow(/different content/);
  });
  it('replays completed results through a new database connection without dispatch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-operations-')); directories.push(directory);
    const path = join(directory, 'test.sqlite');
    await new OperationExecutor(await open(path)).execute('story:2', { a: 1 }, async () => ({ accepted: false }));
    const dispatch = vi.fn(async () => null);
    expect(await new OperationExecutor(await open(path)).execute('story:2', { a: 1 }, dispatch)).toEqual({ accepted: false });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('never redispatches a crash-window pending operation or a failed dispatch', async () => {
    const store = await open(); store.claim('story:3', operationDigest({ a: 1 }));
    const executor = new OperationExecutor(store); const dispatch = vi.fn(async () => { throw Error('timeout'); });
    await expect(executor.execute('story:3', { a: 1 }, dispatch)).rejects.toThrow(/unknown/);
    expect(dispatch).not.toHaveBeenCalled();
    await expect(executor.execute('story:4', {}, dispatch)).rejects.toThrow(/unknown/);
    await expect(executor.execute('story:4', {}, dispatch)).rejects.toThrow(/unknown/);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('canonicalizes object keys but preserves reference ordering and values', () => {
    expect(operationDigest({ b: 2, a: 1 })).toBe(operationDigest({ a: 1, b: 2 }));
    expect(operationDigest(['a', 'b'])).not.toBe(operationDigest(['b', 'a']));
  });
  it('expires saved content without allowing the operation ID to dispatch again', async () => {
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValue(1_000);
      const store = await open(); const executor = new OperationExecutor(store);
      await executor.execute('expired:1', {}, async () => ({ text: 'Private generated content' }));
      clock.mockReturnValue(1_000 + 8 * 24 * 60 * 60 * 1000);
      const dispatch = vi.fn(async () => null);
      await expect(executor.execute('expired:1', {}, dispatch)).rejects.toThrow(/expired/);
      expect(dispatch).not.toHaveBeenCalled();
      expect(store.claim('expired:1', operationDigest({})).row.result).toBeNull();
    } finally { clock.mockRestore(); }
  });
});
