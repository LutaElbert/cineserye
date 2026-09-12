import { expect, it, vi } from 'vitest';
import { recoverRetainedVideoClip } from './recover-video-clip';
import { createHash } from 'node:crypto';
import type { CinemaVideoClipRecord, CinemaVideoOperationRecord } from '../../domain/cinema/visual-preproduction';
import type { VideoOperationResponse } from './video-api';

function setup() {
  const clip = { id: 'clip', operationId: 'operation', shotId: 'shot', revisionId: 'revision', provider: 'provider', model: 'model',
    capabilityProfileVersion: '1', byteSize: 5, width: 160, height: 90, durationSeconds: 1,
    blobHash: createHash('sha256').update('bytes').digest('hex'), status: 'approved' } as CinemaVideoClipRecord;
  const operation = { id: 'operation', shotId: 'shot', revisionId: 'revision', provider: 'provider', model: 'model', capabilityProfileVersion: '1' } as CinemaVideoOperationRecord;
  const result = { ok: true, operation: { operationId: 'operation', provider: 'provider', model: 'model', capability: { version: '1' }, status: 'ready',
    clip: { id: 'clip', byteSize: 5, width: 160, height: 90, durationSeconds: 1, base64: 'Ynl0ZXM=' } } } as Extract<VideoOperationResponse, { ok: true }>;
  let active = true;
  const persist = vi.fn(async ({ blob }: { blob: Blob }) => ({ hash: clip.blobHash, blob, mimeType: 'video/mp4', width: 160, height: 90, byteSize: 5, createdAt: 0 }));
  return { options: { clip, operation, result, ownsResult: () => active, persist }, detach: () => { active = false; } };
}
it('recovers identical bytes without changing existing approval or metadata', async () => {
  const t = setup(), original = structuredClone(t.options.clip);
  expect(await recoverRetainedVideoClip(t.options)).toBe(true);
  expect(t.options.persist).toHaveBeenCalledOnce(); expect(t.options.clip).toEqual(original);
});
for (const mismatch of ['owner', 'provider', 'id', 'size', 'hash', 'pending'] as const) it(`rejects ${mismatch} before storing bytes`, async () => {
  const t = setup();
  if (mismatch === 'owner') t.options.operation.shotId = 'other';
  if (mismatch === 'provider') t.options.result.operation.provider = 'other';
  if (mismatch === 'id') t.options.result.operation.clip!.id = 'other';
  if (mismatch === 'size') t.options.result.operation.clip!.byteSize = 6;
  if (mismatch === 'hash') t.options.clip.blobHash = 'a'.repeat(64);
  if (mismatch === 'pending') t.options.result.operation.status = 'running';
  await expect(recoverRetainedVideoClip(t.options)).rejects.toThrow(); expect(t.options.persist).not.toHaveBeenCalled();
});
it('does not update a replaced owner after persistence finishes', async () => {
  const t = setup(); let finish!: () => void; const gate = new Promise<void>(resolve => { finish = resolve; });
  const original = t.options.persist.getMockImplementation()!;
  t.options.persist.mockImplementation(async input => { await gate; return original(input); });
  const pending = recoverRetainedVideoClip(t.options);
  await vi.waitFor(() => expect(t.options.persist).toHaveBeenCalledOnce());
  t.detach(); finish(); expect(await pending).toBe(false);
});
