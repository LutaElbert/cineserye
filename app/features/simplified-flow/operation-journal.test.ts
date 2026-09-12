import { beforeEach, expect, it } from 'vitest';
import { ensureClientOperation, listClientOperations, observeClientOperation, OPERATION_JOURNAL_KEY, recordClientOperationIntent, reconcileProjectOperations } from './operation-journal';
import { createEmptyCinemaProjectData } from '../../domain/cinema/project-data';
import { createEmptyVisualPreproductionData } from '../../domain/cinema/visual-preproduction';

class MemoryStorage {
  value = new Map<string, string>();
  getItem(key: string) { return this.value.get(key) ?? null; }
  setItem(key: string, value: string) { this.value.set(key, value); }
}
let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); });
const input = (id = 'video-1') => ({ id, projectId: 'project', kind: 'video-generation' as const, scopeKey: 'scene:shot:revision',
  sourceFingerprint: 'a'.repeat(64), provider: 'fixture', model: 'fixture', estimateUsd: 0 });

it('persists intent before dispatch and survives a new reader', () => {
  recordClientOperationIntent(input(), storage);
  expect(listClientOperations('project', storage)).toMatchObject([{ id: 'video-1', phase: 'intent', dispatchCertainty: 'not-dispatched' }]);
  expect(new MemoryStorage().getItem(OPERATION_JOURNAL_KEY)).toBeNull();
  const restored = new MemoryStorage(); restored.value = new Map(storage.value);
  expect(listClientOperations('project', restored)[0].id).toBe('video-1');
});
it('accepts the direct shot-planning ownership identity', () => {
  const projectId = crypto.randomUUID();
  recordClientOperationIntent({ id: crypto.randomUUID(), projectId, kind: 'shot-plan', scopeKey: 'scene-01',
    sourceFingerprint: '1234abcd', provider: 'fixture-shot-planner', model: 'fixture-v1', estimateUsd: 0 }, storage);
  expect(listClientOperations(projectId, storage)).toMatchObject([{ projectId, kind: 'shot-plan', scopeKey: 'scene-01' }]);
});
it('never overwrites a duplicate operation identity', () => {
  recordClientOperationIntent(input(), storage);
  expect(() => recordClientOperationIntent(input(), storage)).toThrow('already exists');
  expect(listClientOperations(undefined, storage)).toHaveLength(1);
});
it('updates only the exact project, kind and scope', () => {
  recordClientOperationIntent(input(), storage);
  const owner = { projectId: 'project', kind: 'video-generation' as const, scopeKey: 'scene:shot:revision' };
  expect(observeClientOperation('video-1', owner, { phase: 'unknown', dispatchCertainty: 'may-have-dispatched', lastError: 'Connection lost' }, storage))
    .toMatchObject({ phase: 'unknown', dispatchCertainty: 'may-have-dispatched' });
  expect(() => observeClientOperation('video-1', { ...owner, scopeKey: 'other' }, { phase: 'succeeded' }, storage)).toThrow('another scope');
  expect(listClientOperations(undefined, storage)[0].phase).toBe('unknown');
});
it('rejects corrupt and future journals without silently replacing them', () => {
  for (const value of ['{', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [{ id: '__proto__' }] })]) {
    storage.setItem(OPERATION_JOURNAL_KEY, value);
    expect(() => recordClientOperationIntent(input(), storage)).toThrow(/recovery data|unsupported format/);
    expect(storage.getItem(OPERATION_JOURNAL_KEY)).toBe(value);
  }
});
it('does not claim percentages without real compatible totals', () => {
  recordClientOperationIntent(input(), storage);
  const owner = { projectId: 'project', kind: 'video-generation' as const, scopeKey: 'scene:shot:revision' };
  expect(() => observeClientOperation('video-1', owner, { completedUnits: 2, totalUnits: 1 }, storage)).toThrow('observation is invalid');
  expect(listClientOperations(undefined, storage)[0]).toMatchObject({ completedUnits: null, totalUnits: null });
});
it('reconciles restored document operations without dispatching or changing identity', () => {
  const project = createEmptyCinemaProjectData('project'); project.visualPreproduction = createEmptyVisualPreproductionData();
  project.visualPreproduction.storyboardRuns.image = { id: 'image', shotId: 'shot', revisionId: 'revision', promptId: 'prompt', promptVersion: 1,
    referenceIds: [], provider: 'fixture', model: 'fixture', aspectRatio: '9:16', outputCount: 2, intent: 'balanced', estimatedCost: 0,
    currency: 'USD', status: 'completed', consentedAt: '2026-09-11T00:00:00.000Z', startedAt: '2026-09-11T00:00:00.000Z', completedAt: '2026-09-11T00:00:01.000Z', error: null };
  expect(reconcileProjectOperations(project, storage)).toBe(1);
  expect(listClientOperations('project', storage)[0]).toMatchObject({ id: 'image', phase: 'awaiting-review', dispatchCertainty: 'completed' });
  expect(reconcileProjectOperations(project, storage)).toBe(1);
  expect(listClientOperations('project', storage)).toHaveLength(1);
});
it('does not let an older restored document regress or resurrect an existing journal outcome', () => {
  ensureClientOperation(input(), { phase: 'unknown', dispatchCertainty: 'may-have-dispatched', lastError: 'Lost response' }, storage);
  ensureClientOperation(input(), { phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null }, storage);
  expect(listClientOperations('project', storage)[0]).toMatchObject({ phase: 'unknown', lastError: 'Lost response' });
});
it('fails closed when a restored document reuses an operation id for another scope', () => {
  ensureClientOperation(input(), { phase: 'unknown' }, storage);
  const project = createEmptyCinemaProjectData('project'); project.visualPreproduction = createEmptyVisualPreproductionData();
  project.visualPreproduction.videoOperations['video-1'] = { id: 'video-1', shotId: 'other', revisionId: 'revision', promptId: 'prompt', promptVersion: 1,
    promptText: 'Prompt', negativeConstraints: [], startFrameId: 'frame', startFrameApproval: 'approved', endFrameId: null, endFrameApproval: null,
    referenceIds: [], provider: 'fixture', model: 'fixture', capabilityProfileVersion: '1', settings: { aspectRatio: '9:16', durationSeconds: 4,
      resolution: '720p', audio: false, outputCount: 1, seed: null }, estimatedCost: 0, currency: 'USD', providerOperationId: null,
    status: 'unknown', retryOf: null, consentedAt: '2026-09-11T00:00:00.000Z', startedAt: '2026-09-11T00:00:00.000Z', completedAt: null, error: 'Unknown' };
  expect(() => reconcileProjectOperations(project, storage)).toThrow('conflicts');
  expect(listClientOperations('project', storage)[0].scopeKey).toBe('scene:shot:revision');
});
