import { expect, it, vi } from 'vitest';
import { applyOwnedVideoSnapshot } from './apply-video-snapshot';
import { createEmptyVisualPreproductionData, type CinemaVideoOperationRecord } from '../../domain/cinema/visual-preproduction';
import type { VideoOperationResponse } from './video-api';
const record: CinemaVideoOperationRecord = { id: 'operation-1', shotId: 'shot-1', revisionId: 'revision-1', promptId: 'prompt-1', promptVersion: 1,
  promptText: 'A film', negativeConstraints: [], startFrameId: 'frame-1', startFrameApproval: 'approved', endFrameId: null, endFrameApproval: null,
  referenceIds: [], provider: 'cineserye-video-fixture', model: 'fixture-motion-board-v1', capabilityProfileVersion: '1',
  settings: { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
  estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'running', retryOf: null,
  consentedAt: '2026-09-11T00:00:00Z', startedAt: '2026-09-11T00:00:00Z', completedAt: null, error: null };
const result: Extract<VideoOperationResponse, { ok: true }> = { ok: true, version: 1, mode: 'fixture', operation: {
  operationId: record.id, providerOperationId: 'handle-1', status: 'ready', provider: record.provider, model: record.model,
  capability: { version: '1', provider: record.provider, model: record.model, supportsEndFrame: true, supportsReferenceImages: false, supportsAudio: false },
  estimatedCost: 0, currency: 'USD', error: null, cancellationNote: null,
  clip: { id: 'clip-1', mimeType: 'video/mp4', base64: 'Ynl0ZXM=', width: 160, height: 90, byteSize: 5, durationSeconds: 1 },
} };
function setup() {
  let visual = { ...createEmptyVisualPreproductionData(), videoOperations: { [record.id]: structuredClone(record) } }, active = true;
  const options = { result: structuredClone(result), ownsResult: () => active, current: () => visual,
    update: vi.fn((update: (current: typeof visual) => typeof visual) => { visual = update(visual); }),
    persist: vi.fn(async ({ blob }: { blob: Blob }) => ({ hash: 'a'.repeat(64), blob, mimeType: 'video/mp4', width: 160, height: 90, byteSize: 5, createdAt: 0 })) };
  return { options, current: () => visual, detach: () => { active = false; } };
}
it('persists once then atomically installs an unapproved candidate under the exact operation', async () => {
  const t = setup(); expect(await applyOwnedVideoSnapshot(t.options)).toBe(true);
  expect(t.current().videoClips['clip-1']).toMatchObject({ status: 'candidate', shotId: record.shotId, revisionId: record.revisionId });
  expect(t.current().videoOperations[record.id].status).toBe('ready');
  await applyOwnedVideoSnapshot(t.options); expect(t.options.persist).toHaveBeenCalledOnce();
});
for (const change of ['owner', 'record-removed', 'source', 'cancelled'] as const) it(`rejects ${change} while artifact persistence is pending`, async () => {
  const t = setup(); let finish!: () => void; const gate = new Promise<void>(resolve => { finish = resolve; });
  const original = t.options.persist.getMockImplementation()!;
  t.options.persist.mockImplementation(async input => { await gate; return original(input); });
  const pending = applyOwnedVideoSnapshot(t.options);
  if (change === 'owner') t.detach();
  else if (change === 'record-removed') delete t.current().videoOperations[record.id];
  else if (change === 'source') t.current().videoOperations[record.id].revisionId = 'new-revision';
  else t.current().videoOperations[record.id].status = 'cancelled';
  finish(); expect(await pending).toBe(false); expect(t.options.update).not.toHaveBeenCalled(); expect(t.current().videoClips).toEqual({});
});
it('storage failure leaves the operation unresolved and retrievable, not falsely failed', async () => {
  const t = setup(); t.options.persist.mockRejectedValue(Error('Quota'));
  await expect(applyOwnedVideoSnapshot(t.options)).rejects.toThrow('Quota');
  expect(t.current().videoOperations[record.id].status).toBe('running'); expect(t.current().videoClips).toEqual({});
});
it('rejects wrong provider provenance and declared byte count before persistence', async () => {
  const t = setup(); t.options.result.operation.provider = 'different';
  await expect(applyOwnedVideoSnapshot(t.options)).rejects.toThrow('provenance');
  t.options.result.operation.provider = record.provider; t.options.result.operation.clip!.byteSize++;
  await expect(applyOwnedVideoSnapshot(t.options)).rejects.toThrow('declared bytes'); expect(t.options.persist).not.toHaveBeenCalled();
});
it('does not regress terminal observations or recreate a removed operation', async () => {
  const t = setup(); t.current().videoOperations[record.id].status = 'cancelled';
  expect(await applyOwnedVideoSnapshot(t.options)).toBe(false); expect(t.current().videoOperations[record.id].status).toBe('cancelled');
  delete t.current().videoOperations[record.id]; await applyOwnedVideoSnapshot(t.options); expect(t.current().videoOperations).toEqual({});
});
it('an unknown observation pauses automatic tracking without inventing completion or losing same-ID recovery', async () => {
  const t = setup();
  const unknown = { ...result, operation: { ...result.operation, status: 'unknown' as const, error: 'Connection lost', clip: null } };
  expect(await applyOwnedVideoSnapshot({ ...t.options, result: unknown })).toBe(true);
  expect(t.current().videoOperations[record.id]).toMatchObject({ status: 'unknown', completedAt: null, providerOperationId: 'handle-1' });
  expect(t.options.persist).not.toHaveBeenCalled();
  expect(await applyOwnedVideoSnapshot(t.options)).toBe(true);
  expect(t.current().videoOperations[record.id]).toMatchObject({ status: 'ready', error: null });
  expect(t.current().videoClips['clip-1'].status).toBe('candidate');
});
