import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { OperationRepository, operationDigest } from './operation-repository';
import { VideoOperationStore, type SavedVideoOperation } from './video-operation-store';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';

for (const pause of ['stop', 'transport-unknown'] as const) it.each(['running', 'ready'] as const)(`live ${pause} fences a late %s observation across repository instances and reopen`, async status => {
  const directory = await mkdtemp(join(tmpdir(), 'cineserye-observation-test-')), path = join(directory, 'ledger.sqlite');
  const a = new VideoOperationStore(await OperationRepository.open(path));
  const b = new VideoOperationStore(await OperationRepository.open(path));
  let reopened: VideoOperationStore | undefined;
  const input: SavedVideoOperation = { version: 1, owner: { projectId: 'project', sceneId: 'scene', shotId: 'shot', revisionId: 'revision', operationId: 'observation-race' },
    digest: operationDigest('reviewed'), mode: 'live', provider: { id: 'google-vertex-ai', model: 'model', project: 'project', location: 'region' },
    capability: FIXTURE_VIDEO_CAPABILITIES, settings: { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    handle: { name: '', startedAt: 1000 }, status: 'queued', estimatedCost: 1, currency: 'USD', error: null, clip: null };
  const dispatch = vi.fn(async () => ({ name: 'original-handle', startedAt: 1000 }));
  let finish!: () => void; const pending = new Promise<void>(resolve => { finish = resolve; });
  try {
    await a.start(input, dispatch);
    const observation = a.poll(input.owner, async saved => { await pending; return { ...saved, status }; });
    const paused = pause === 'stop' ? b.cancel(input.owner)
      : await b.poll(input.owner, async saved => ({ ...saved, status: 'unknown', error: 'Connection lost' }));
    expect(paused.status).toBe('unknown');
    finish(); expect((await observation).status).toBe('unknown');
    reopened = new VideoOperationStore(await OperationRepository.open(path));
    expect(reopened.read(input.owner)).toMatchObject({ status: 'unknown', handle: { name: 'original-handle', startedAt: 1000 } });
    // An observation begun AFTER the stop can reconcile the same retained ID.
    expect((await reopened.poll(input.owner, async saved => ({ ...saved, status: 'running' }))).status).toBe('running');
    expect(dispatch).toHaveBeenCalledTimes(1);
  } finally { finish(); reopened?.close(); a.close(); b.close(); await rm(directory, { recursive: true, force: true }); }
});
