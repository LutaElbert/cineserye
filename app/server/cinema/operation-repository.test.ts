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
  it.each(['pending', 'unknown'] as const)('rejects NUL scope before claiming or dispatching around an existing %s operation', async (status) => {
    const store = await open(); const scope = 'story:project\0x:';
    // Characterize an old malformed record without making a new provider call.
    store.claim(`${scope}first`, operationDigest({}));
    if (status === 'unknown') store.unknown(`${scope}first`);
    const executor = new OperationExecutor(store); const dispatch = vi.fn(async () => null);
    await expect(executor.execute(`${scope}second`, {}, dispatch, scope)).rejects.toThrow(/scope/);
    await expect(executor.execute('story:valid:operation\0suffix', {}, dispatch, 'story:valid:')).rejects.toThrow(/scope/);
    expect(store.read(`${scope}second`)).toBeUndefined();
    expect(store.read('story:valid:operation\0suffix')).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('atomically fences competing IDs in one scope, without blocking another project', async () => {
    const executor = new OperationExecutor(await open());
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const dispatch = vi.fn(async () => { await held; return { result: 'saved' }; });
    const first = executor.execute('story:a:first', {}, dispatch, 'story:a:');
    const extra = vi.fn(async () => ({ result: 'other' }));
    await expect(executor.execute('story:a:second', {}, extra, 'story:a:')).rejects.toThrow(/earlier Story request/);
    expect(executor.read('story:a:second')).toBeUndefined();
    await expect(executor.execute('story:b:first', {}, extra, 'story:b:')).resolves.toEqual({ result: 'other' });
    release(); await first;
    await expect(executor.execute('story:a:second', {}, extra, 'story:a:')).resolves.toEqual({ result: 'other' });
    expect(dispatch).toHaveBeenCalledTimes(1); expect(extra).toHaveBeenCalledTimes(2);
  });
  it.each(['pending', 'unknown'] as const)('retains the %s scope fence across a new database connection and ID', async (status) => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-scope-fence-')); directories.push(directory);
    const path = join(directory, 'test.sqlite'); const store = await open(path);
    store.claim('story:project:first', operationDigest({}));
    if (status === 'unknown') store.unknown('story:project:first');
    const executor = new OperationExecutor(await open(path)); const dispatch = vi.fn(async () => null);
    await expect(executor.execute('story:project:new-id', {}, dispatch, 'story:project:')).rejects.toThrow(/earlier Story request/);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('treats wildcard-like project names literally and rejects mismatched scope', async () => {
    const executor = new OperationExecutor(await open()); const dispatch = vi.fn(async () => null);
    await expect(executor.execute('story:a:one', {}, dispatch, 'story:b:')).rejects.toThrow(/scope/);
    await expect(executor.execute('story:a:one', {}, dispatch, '')).rejects.toThrow(/scope/);
    expect(dispatch).not.toHaveBeenCalled();
    const store = await open(); store.claim('story:a_:pending', 'digest');
    expect(() => store.claimExclusive('story:ab:next', 'digest', 'story:ab:')).not.toThrow();
    expect(() => store.claimExclusive('story:a_:next', 'digest', 'story:a_:')).toThrow(/earlier Story request/);
    store.claim('story:🎬:pending', 'digest');
    expect(() => store.claimExclusive('story:🎬:next', 'digest', 'story:🎬:')).toThrow(/earlier Story request/);
    store.claim('story:nested:project:pending', 'digest');
    expect(() => store.claimExclusive('story:nested:next', 'digest', 'story:nested:')).not.toThrow();
    expect(() => store.claimExclusive('story:nested:project:next', 'digest', 'story:nested:project:')).toThrow(/earlier Story request/);
  });
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
