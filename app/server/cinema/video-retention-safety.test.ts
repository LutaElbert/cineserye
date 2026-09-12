import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { OperationRepository, operationDigest } from './operation-repository';
import { VideoOperationStore, type SavedVideoOperation } from './video-operation-store';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';

function checkpoint(): SavedVideoOperation {
  return { version: 1, owner: { projectId: 'old-project', sceneId: 'old-scene', shotId: 'old-shot', revisionId: 'old-revision', operationId: 'old-live-operation' },
    digest: operationDigest('old-approved-content'), mode: 'live', provider: { id: 'google-vertex-ai', model: 'model', project: 'project', location: 'region' },
    capability: FIXTURE_VIDEO_CAPABILITIES, settings: { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    handle: { name: 'original-provider-handle', startedAt: 1000 }, status: 'cancelled', estimatedCost: 1, currency: 'USD', error: 'Stopped locally', clip: null };
}

function legacyDatabase(repository: OperationRepository) {
  return Reflect.get(repository, 'database') as import('node:sqlite').DatabaseSync;
}
function seedOldCompletion(repository: OperationRepository, old: SavedVideoOperation) {
  // Seed the actual OLD schema without invoking modern complete()/retention.
  legacyDatabase(repository).prepare("INSERT INTO operations (key,digest,status,result,updated_at) VALUES (?,?,'completed',?,?)")
    .run(`video:${operationDigest(old.owner)}`, old.digest, JSON.stringify(old), 1000);
}
function freshRequest(old: SavedVideoOperation): SavedVideoOperation {
  return { ...old, owner: { ...old.owner, operationId: 'fresh-operation' }, status: 'queued', error: null, handle: { name: '', startedAt: Date.now() } };
}

it.each(['failed', 'cancelled', 'timed-out'] as const)('protects legacy live %s before age pruning on repository reopen', async status => {
  const directory = await mkdtemp(join(tmpdir(), 'cineserye-retention-test-')), path = join(directory, 'ledger.sqlite');
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  let repository: OperationRepository | undefined;
  try {
    repository = await OperationRepository.open(path); const old = { ...checkpoint(), status };
    seedOldCompletion(repository, old); repository.close(); repository = undefined;
    clock.mockReturnValue(1000 + 8 * 24 * 60 * 60 * 1000);
    repository = await OperationRepository.open(path); const store = new VideoOperationStore(repository);
    const dispatch = vi.fn(async () => ({ name: 'second-purchase', startedAt: Date.now() }));
    await expect(store.start(freshRequest(old), dispatch)).rejects.toThrow(/earlier video request/);
    expect(dispatch).not.toHaveBeenCalled(); expect(store.read(old.owner)).toMatchObject({ status: 'unknown', handle: { name: 'original-provider-handle' } });
  } finally { repository?.close(); clock.mockRestore(); await rm(directory, { recursive: true, force: true }); }
});

it('protects legacy live uncertainty before result-count pruning', async () => {
  const repository = await OperationRepository.open(':memory:'), old = checkpoint();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    seedOldCompletion(repository, old);
    for (let index = 0; index < 101; index++) {
      clock.mockReturnValue(2000 + index); const other = `fixture:${index}`;
      repository.claim(other, 'digest'); repository.complete(other, { harmless: true });
    }
    const store = new VideoOperationStore(repository), dispatch = vi.fn(async () => ({ name: 'duplicate', startedAt: Date.now() }));
    await expect(store.start(freshRequest(old), dispatch)).rejects.toThrow(/earlier video request/);
    expect(dispatch).not.toHaveBeenCalled(); expect(store.read(old.owner).status).toBe('unknown');
  } finally { repository.close(); clock.mockRestore(); }
});

it('already-pruned unscoped legacy tombstones fail closed for fresh IDs', async () => {
  const repository = await OperationRepository.open(':memory:'), old = checkpoint();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const key = `video:${operationDigest(old.owner)}`;
    // Model an irreversibly pruned legacy row: its remaining digest cannot tell
    // us whether a past completion was real or merely a local cancellation.
    repository.claim(key, old.digest); repository.complete(key, { lostLegacyOwnership: true });
    clock.mockReturnValue(1000 + 8 * 24 * 60 * 60 * 1000); expect(repository.read(key)?.status).toBe('expired');
    const store = new VideoOperationStore(repository), dispatch = vi.fn(async () => ({ name: 'duplicate', startedAt: Date.now() }));
    await expect(store.start(freshRequest(old), dispatch)).rejects.toThrow(/no retained ownership/);
    expect(dispatch).not.toHaveBeenCalled(); expect(repository.read(key)?.status).toBe('expired');
  } finally { repository.close(); clock.mockRestore(); }
});

it('protects legacy uncertainty from the byte-budget prune path', async () => {
  const repository = await OperationRepository.open(':memory:'), old = checkpoint();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const database = legacyDatabase(repository), prepare = database.prepare.bind(database);
  let queried = false;
  // Only size accounting is synthetic (avoid allocating 256 MiB in a test).
  // Filtering, updates, migration and admission use the actual SQLite queries.
  const spy = vi.spyOn(database, 'prepare').mockImplementation(sql => {
    const statement = prepare(sql);
    if (sql.includes('AS bytes')) {
      const all = statement.all.bind(statement);
      vi.spyOn(statement, 'all').mockImplementation((...args) => {
        queried = true;
        return all(...args).map(row => ({ ...row, bytes: 256 * 1024 * 1024 + 1 }));
      });
    }
    return statement;
  });
  try {
    seedOldCompletion(repository, old);
    repository.claim('fixture:trigger-byte-prune', 'digest');
    const store = new VideoOperationStore(repository), dispatch = vi.fn(async () => ({ name: 'duplicate', startedAt: Date.now() }));
    await expect(store.start(freshRequest(old), dispatch)).rejects.toThrow(/earlier video request/);
    expect(queried).toBe(true); expect(dispatch).not.toHaveBeenCalled();
    expect(store.read(old.owner)).toMatchObject({ status: 'unknown', handle: old.handle });
  } finally { spy.mockRestore(); repository.close(); clock.mockRestore(); }
});
