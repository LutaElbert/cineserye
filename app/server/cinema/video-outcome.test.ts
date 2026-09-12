import { expect, it, vi } from 'vitest';
import { OperationRepository, operationDigest } from './operation-repository';
import { VideoOperationStore, type SavedVideoOperation } from './video-operation-store';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';

it('a lost provider start remains unknown, never a retryable failure, on the same ID', async () => {
  const repository = await OperationRepository.open(':memory:');
  const store = new VideoOperationStore(repository);
  const input: SavedVideoOperation = { version: 1, owner: { projectId: 'project', sceneId: 'scene', shotId: 'shot', revisionId: 'revision', operationId: 'unknown-outcome' },
    digest: operationDigest('reviewed'), mode: 'fixture', provider: { id: 'cineserye-video-fixture', model: 'fixture-motion-board-v1', project: null, location: null },
    capability: FIXTURE_VIDEO_CAPABILITIES, settings: { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    handle: { name: '', startedAt: Date.now() }, status: 'queued', estimatedCost: 0, currency: 'USD', error: null, clip: null };
  const dispatch = vi.fn(async () => { throw Error('Connection lost after dispatch'); });
  try {
    expect(await store.start(input, dispatch)).toMatchObject({ status: 'unknown', clip: null });
    expect(store.read(input.owner)).toMatchObject({ status: 'unknown', error: expect.stringContaining('will not be dispatched again') });
    expect(await store.start(input, dispatch)).toMatchObject({ status: 'unknown' });
    expect(dispatch).toHaveBeenCalledTimes(1);
  } finally { store.close(); }
});
