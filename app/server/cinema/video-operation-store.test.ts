import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenerateVideosOperation } from '@google/genai';
import { OperationRepository, operationDigest } from './operation-repository';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';
import { VideoOperationStore, type SavedVideoOperation } from './video-operation-store';

const directories: string[] = [];
const stores: VideoOperationStore[] = [];
afterEach(async () => { stores.splice(0).forEach((store) => store.close()); for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function open(path: string) { const store = new VideoOperationStore(await OperationRepository.open(path)); stores.push(store); return store; }
function initial(): SavedVideoOperation {
  return { version: 1, owner: { projectId: 'project', sceneId: 'scene', shotId: 'shot', revisionId: 'revision', operationId: 'owned-video-123' },
    digest: operationDigest({ approved: 'content-and-estimate' }), mode: 'fixture', provider: { id: 'cineserye-video-fixture', model: 'fixture-motion-board-v1', project: null, location: null },
    capability: FIXTURE_VIDEO_CAPABILITIES, settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    handle: { name: '', startedAt: Date.now() }, status: 'queued', estimatedCost: 0, currency: 'USD', error: null, clip: null };
}
const handle = () => ({ name: 'persisted-provider-handle', startedAt: Date.now(), operation: Object.assign(new GenerateVideosOperation(), { sensitive: 'never-persist-sdk-payload' }) });

describe('durable owned local video tracking', () => {
  it('fences a fresh ID and revision for an unresolved shot across repository instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-video-fence-test-')); directories.push(directory);
    const path = join(directory, 'operations.sqlite'), first = await open(path), input = initial();
    const dispatch = vi.fn(async () => { throw Error('Start outcome unknown'); });
    await first.start(input, dispatch);
    const second = await open(path), next = { ...input, owner: { ...input.owner, operationId: 'brand-new-id', revisionId: 'new-revision' } };
    await expect(second.start(next, dispatch)).rejects.toThrow(/earlier video request/);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const unrelated = { ...next, owner: { ...next.owner, shotId: 'different-shot' } };
    await second.start(unrelated, async () => handle());
    expect(second.read(unrelated.owner).handle.name).toBe('persisted-provider-handle');
  });
  it('a live local stop retains the handle, remains unresolved and supports read-only reconciliation', async () => {
    const store = await open(':memory:'), input = { ...initial(), mode: 'live' as const };
    let finish!: (value: ReturnType<typeof handle>) => void;
    const dispatch = vi.fn(() => new Promise<ReturnType<typeof handle>>(resolve => { finish = resolve; }));
    const pending = store.start(input, dispatch); await Promise.resolve();
    expect(store.cancel(input.owner)).toMatchObject({ status: 'unknown', clip: null });
    finish(handle()); expect(await pending).toMatchObject({ status: 'unknown', handle: { name: 'persisted-provider-handle' } });
    await expect(store.start({ ...input, owner: { ...input.owner, operationId: 'after-local-stop' } }, dispatch)).rejects.toThrow(/earlier video request/);
    expect(await store.poll(input.owner, async saved => ({ ...saved, status: 'running', error: null }))).toMatchObject({ status: 'running', error: null });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('migrates a legacy live cancellation without losing identity or allowing a new dispatch', async () => {
    const repository = await OperationRepository.open(':memory:');
    const input = { ...initial(), mode: 'live' as const, handle: handle(), status: 'cancelled' as const };
    const oldKey = `video:${operationDigest(input.owner)}`;
    repository.claim(oldKey, input.digest); repository.complete(oldKey, input);
    const store = new VideoOperationStore(repository); stores.push(store);
    expect(store.read(input.owner)).toMatchObject({ status: 'unknown', handle: { name: 'persisted-provider-handle' } });
    const dispatch = vi.fn(async () => handle());
    await expect(store.start({ ...input, owner: { ...input.owner, operationId: 'new-after-old-backup' } }, dispatch)).rejects.toThrow(/earlier video request/);
    expect(await store.poll(input.owner, async saved => ({ ...saved, status: 'failed', error: 'Confirmed provider failure' }))).toMatchObject({ status: 'failed', outcomeVersion: 1 });
    await store.start({ ...initial(), owner: { ...input.owner, operationId: 'fresh-approved-after-failure' } }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('preserves old expired tombstones and refuses to revive them on replay', async () => {
    const repository = await OperationRepository.open(':memory:'), input = initial();
    const oldKey = `video:${operationDigest(input.owner)}`;
    repository.claim(oldKey, input.digest); repository.complete(oldKey, { ...input, status: 'failed' });
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);
    try {
      expect(repository.read(oldKey)?.status).toBe('expired');
      const store = new VideoOperationStore(repository); stores.push(store);
      const dispatch = vi.fn(async () => handle());
      await expect(store.start(input, dispatch)).rejects.toThrow(/expired/);
      expect(dispatch).not.toHaveBeenCalled(); expect(repository.read(oldKey)?.status).toBe('expired');
    } finally { now.mockRestore(); }
  });
  it('fails closed for a legacy dispatch missing its ownership checkpoint', async () => {
    const repository = await OperationRepository.open(':memory:'), input = initial();
    repository.claim(`video:${operationDigest(input.owner)}`, input.digest);
    const store = new VideoOperationStore(repository); stores.push(store);
    const dispatch = vi.fn(async () => handle());
    await expect(store.start({ ...input, owner: { ...input.owner, operationId: 'different-id' } }, dispatch)).rejects.toThrow(/no retained ownership/);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('validates exact ownership before coalescing a pending status read', async () => {
    const store = await open(':memory:'), input = initial(); await store.start(input, async () => handle());
    let finish!: (value: SavedVideoOperation) => void;
    const read = vi.fn(() => new Promise<SavedVideoOperation>(resolve => { finish = resolve; }));
    const pending = store.poll(input.owner, read);
    await expect(store.poll({ ...input.owner, revisionId: 'wrong-revision' }, read)).rejects.toThrow(/owned/);
    finish({ ...store.read(input.owner), status: 'running' }); await pending;
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('survives a fresh repository instance and never purchases a repeated approved operation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-video-store-test-')); directories.push(directory);
    const path = join(directory, 'operations.sqlite'), first = await open(path), input = initial(), dispatch = vi.fn(async () => handle());
    const started = await first.start(input, dispatch);
    expect(started.handle).toEqual({ name: 'persisted-provider-handle', startedAt: expect.any(Number) });
    stores.splice(stores.indexOf(first), 1); first.close();
    const restored = await open(path);
    expect(restored.read(input.owner)).toEqual(started);
    expect(await restored.start(input, dispatch)).toEqual(started); expect(dispatch).toHaveBeenCalledTimes(1);
    const poll = vi.fn(async (saved: SavedVideoOperation) => ({ ...saved, status: 'running' as const }));
    expect((await restored.poll(input.owner, poll)).status).toBe('running');
    expect(poll.mock.calls[0][0].handle.name).toBe('persisted-provider-handle');
  });
  it('isolates every owner field and content digest, and retains a terminal cancellation through polling races', async () => {
    const store = await open(':memory:'), input = initial(); await store.start(input, async () => handle());
    for (const field of ['projectId', 'sceneId', 'shotId', 'revisionId', 'operationId']) expect(() => store.read({ ...input.owner, [field]: 'other' })).toThrow(/owned/);
    await expect(store.start({ ...input, digest: operationDigest('changed') }, async () => handle())).rejects.toThrow(/different content/);
    let finish!: (saved: SavedVideoOperation) => void;
    const pending = store.poll(input.owner, () => new Promise((resolve) => { finish = resolve; }));
    expect(store.cancel(input.owner).status).toBe('cancelled');
    finish({ ...store.read(input.owner), status: 'ready' });
    expect((await pending).status).toBe('cancelled'); expect(store.read(input.owner).status).toBe('cancelled');
  });
  it('saves a pre-dispatch claim and refuses uncertain-start retry even after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-video-unknown-test-')); directories.push(directory);
    const path = join(directory, 'operations.sqlite'), first = await open(path), input = initial();
    const start = vi.fn(async () => { throw new Error('Connection lost after provider received request'); });
    expect(await first.start(input, start)).toMatchObject({ status: 'unknown', error: expect.stringMatching(/unknown/) });
    stores.splice(stores.indexOf(first), 1); first.close();
    const restored = await open(path);
    expect(await restored.start(input, start)).toMatchObject({ status: 'unknown', error: expect.stringMatching(/will not be dispatched again/) });
    expect(start).toHaveBeenCalledTimes(1);
  });
  it('cancel during dispatch cannot be revived when the handle arrives', async () => {
    const store = await open(':memory:'), input = initial();
    let finish!: (value: ReturnType<typeof handle>) => void;
    const pending = store.start(input, () => new Promise((resolve) => { finish = resolve; }));
    await Promise.resolve(); expect(store.cancel(input.owner).status).toBe('cancelled');
    finish(handle()); expect((await pending).status).toBe('cancelled');
    expect(store.read(input.owner).status).toBe('cancelled');
  });
});
