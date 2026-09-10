import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperationRepository, operationDigest } from './operation-repository';
import { ScopedShotCoordinator, ScopedShotNoDispatchError, scopedShotQuote } from './scoped-shot-planning';
import { scopedShotApprovalContent, scopedShotRetryEligible, scopedShotRetryParentContent, ScopedShotStateSchema, type ScopedShotInput, type ScopedShotState, type ScopedShotRetry } from '../../domain/cinema/scoped-shot-planning';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from './workflow';

const stores: OperationRepository[] = [];
afterEach(() => { stores.splice(0).forEach((store) => store.close()); });
const input = (): ScopedShotInput => ({ version: 1, projectId: 'project-test', premiseNodeId: 'story-premise', scenes: [1, 2, 3].map((index) => ({
  sceneId: `scene-${index}`, sourceDigest: 'a'.repeat(64), title: `Scene ${index}`, planningContext: 'All four friends survive.',
  brief: { version: 2, sceneNodeId: `scene-${index}`, sceneText: 'Four friends escape the cursed game together.', creationMode: 'ai-generated',
    aspectRatio: '9:16', targetPlatform: 'other', genreTone: 'Horror', locationPeriod: 'One room', dialogueAudioIntent: 'silent', targetDurationSeconds: 20,
    requiredBeats: [], mustInclude: ['All four survive'], mustAvoid: [], generationBudget: { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 1 },
    productionConstraints: { budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: [] } },
})) });
const quote = scopedShotQuote({ CINESERYE_E2E_FIXTURE: 'true' });
function request(value = input()) { return { version: 1, requestId: crypto.randomUUID(), input: value, quoteId: quote.quoteId,
  contentDigest: operationDigest(scopedShotApprovalContent(value, quote.quoteId)), consent: true, approvedEstimate: 0, mode: 'fixture' }; }
function retryRequest(parent: ScopedShotState, sceneIds = parent.jobs.filter(scopedShotRetryEligible).map((job) => job.sceneId)) {
  const retry: ScopedShotRetry = { parentRequestId: parent.requestId, parentStateDigest: operationDigest(scopedShotRetryParentContent(parent)),
    jobs: parent.jobs.filter((job) => sceneIds.includes(job.sceneId)).map(({ sceneId, runId, sourceDigest }) => ({ sceneId, runId, sourceDigest })) };
  return { ...request(parent.input), retry, contentDigest: operationDigest(scopedShotApprovalContent(parent.input, quote.quoteId, retry)) };
}
async function service(dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId, scene.planningContext))) {
  const store = await OperationRepository.open(':memory:'); stores.push(store);
  return { store, dispatch, coordinator: new ScopedShotCoordinator(store, dispatch) };
}
describe('AC16–20 durable scoped shot planning', () => {
  it('uses exact scene IDs, serial dispatch, saved provenance, and replay without a second call', async () => {
    const { coordinator, dispatch, store } = await service(); const payload = request();
    const initial = coordinator.start(payload, quote); expect(initial.jobs.map((job) => job.status)).toEqual(['queued', 'queued', 'queued']);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const result = coordinator.start(payload, quote); expect(result.jobs.map((job) => job.status)).toEqual(['ready', 'ready', 'ready']);
    expect(dispatch).toHaveBeenCalledTimes(3); expect(result.actualCost).toBeNull();
    const recovered = new ScopedShotCoordinator(store, dispatch).read(payload.input.projectId, payload.requestId);
    expect(recovered).toEqual(result); expect(dispatch).toHaveBeenCalledTimes(3);
    expect(coordinator.read('other-project', payload.requestId)).toBeNull();
  });
  it('retains successful results across an uncertain child outcome, without auto retry', async () => {
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      if (scene.sceneId === 'scene-2') throw Error('Provider timeout after dispatch');
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    const { coordinator } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    expect(coordinator.read(payload.input.projectId, payload.requestId)?.jobs.map((job) => job.status)).toEqual(['ready', 'outcome-unknown', 'ready']);
    coordinator.start(payload, quote); expect(dispatch).toHaveBeenCalledTimes(3);
  });
  it('persists cancellation, stops unstarted jobs and rejects source/cost/scope tampering', async () => {
    let release!: () => void;
    const dispatch = vi.fn(async () => { await new Promise<void>((resolve) => { release = resolve; }); throw Error('Stopped'); });
    const { coordinator, store } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    expect(coordinator.cancel(payload.input.projectId, payload.requestId).status).toBe('cancelled');
    expect(new ScopedShotCoordinator(store, dispatch).read(payload.input.projectId, payload.requestId)?.status).toBe('cancelled');
    release(); await new Promise((resolve) => setTimeout(resolve, 30));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(() => coordinator.start({ ...payload, approvedEstimate: 2 }, quote)).toThrow(/estimate/);
    expect(() => coordinator.start({ ...payload, mode: 'live' }, quote)).toThrow(/provider/);
    expect(() => coordinator.start({ ...payload, input: { ...payload.input, scenes: [...payload.input.scenes, payload.input.scenes[0]] } }, quote)).toThrow();
  });
  it('fails closed when live aggregate estimate exceeds operator ceiling', async () => {
    const liveQuote = scopedShotQuote({ CINESERYE_PROVIDER_MODE: 'live', CINESERYE_LIVE_ENABLED: 'true', CINESERYE_GCLOUD_ACTIVE_ACCOUNT: 'elbertluta@gmail.com',
      GOOGLE_CLOUD_PROJECT: 'cineserye', GOOGLE_CLOUD_QUOTA_PROJECT: 'cineserye', PARALLEL_API_KEY: 'test-only', CINESERYE_LIVE_MAX_RUN_COST: '1', CINESERYE_SHOT_PLAN_ESTIMATED_USD: '0.5' });
    expect(liveQuote.ready).toBe(true);
    const { coordinator, dispatch } = await service(); const value = input();
    expect(() => coordinator.start({ ...request(value), mode: 'live', quoteId: liveQuote.quoteId, approvedEstimate: 1.5,
      contentDigest: operationDigest(scopedShotApprovalContent(value, liveQuote.quoteId)) }, liveQuote)).toThrow(/aggregate/);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('honors a durable Stop from another coordinator before any queued child is sent', async () => {
    let release!: () => void;
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    const { coordinator, store } = await service(dispatch), payload = request();
    coordinator.start(payload, quote);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    const otherProcess = new ScopedShotCoordinator(store, dispatch);
    expect(otherProcess.cancel(payload.input.projectId, payload.requestId).status).toBe('cancelled');
    release();
    await vi.waitFor(() => expect(store.read(`shot-scope:${payload.input.projectId}:${payload.requestId}`)?.status).toBe('completed'));
    expect(dispatch).toHaveBeenCalledOnce();
    // A complete, validated in-flight result is still useful after Stop. Unstarted work stays stopped.
    expect(coordinator.read(payload.input.projectId, payload.requestId)?.jobs.map((job) => job.status)).toEqual(['ready', 'cancelled', 'cancelled']);
  });
  it('rejects persisted ready outputs with a wrong run, mode or scene identity', async () => {
    const { coordinator } = await service(), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const state = coordinator.read(payload.input.projectId, payload.requestId)!;
    expect(ScopedShotStateSchema.safeParse(state).success).toBe(true);
    for (const variant of [
      { ...state, jobs: state.jobs.map((job, index) => index ? job : { ...job, result: { ...job.result!, runId: 'wrong-run' } }) },
      { ...state, jobs: state.jobs.map((job, index) => index ? job : { ...job, result: { ...job.result!, mode: 'live' } }) },
      { ...state, jobs: state.jobs.map((job, index) => index ? job : { ...job, result: state.jobs[1].result }) },
    ]) expect(ScopedShotStateSchema.safeParse(variant).success).toBe(false);
  });
  it('does not recover an unvalidated wrong-scope durable child as ready', async () => {
    let release!: () => void;
    const dispatch = vi.fn(async () => { await new Promise<void>((resolve) => { release = resolve; }); throw Error('Stopped'); });
    const { coordinator, store } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    const active = coordinator.read(payload.input.projectId, payload.requestId)!;
    const wrongResult = await runCinemaPlanningWorkflow(payload.input.scenes[1].brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, active.jobs[0].runId);
    store.complete(`shot-job:${payload.input.projectId}:${active.jobs[0].runId}`, wrongResult);
    const recovered = new ScopedShotCoordinator(store, dispatch).read(payload.input.projectId, payload.requestId)!;
    expect(recovered.jobs[0].status).toBe('outcome-unknown'); expect(recovered.jobs[0].result).toBeNull();
    expect(dispatch).toHaveBeenCalledOnce(); coordinator.cancel(payload.input.projectId, payload.requestId); release();
    await vi.waitFor(() => expect(store.read(`shot-scope:${payload.input.projectId}:${payload.requestId}`)?.status).toBe('completed'));
  });
  it('never exposes an over-duration or changed-aspect plan as ready', async () => {
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      const result = await runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
      if (scene.sceneId === 'scene-1') Object.values(result.cinema.shots)[0].durationSeconds += 1;
      if (scene.sceneId === 'scene-2') result.cinema.scenes[scene.sceneId].brief!.aspectRatio = '16:9';
      return result;
    });
    const { coordinator } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const state = coordinator.read(payload.input.projectId, payload.requestId)!;
    expect(state.jobs.map((job) => job.status)).toEqual(['outcome-unknown', 'outcome-unknown', 'ready']);
    const tampered = structuredClone(state);
    Object.values(tampered.jobs[2].result!.cinema.shots)[0].durationSeconds += 2;
    expect(ScopedShotStateSchema.safeParse(tampered).success).toBe(false);
  });
  it('retries only proven pre-dispatch failure while carrying immutable successes and uncertain siblings through reload', async () => {
    const sent: string[] = []; let rejectSceneTwo = true;
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      if (scene.sceneId === 'scene-2' && rejectSceneTwo) throw new ScopedShotNoDispatchError('Local config changed before provider entry.');
      sent.push(scene.sceneId);
      if (scene.sceneId === 'scene-3') throw Error('Connection dropped after provider received work.');
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    const { coordinator, store } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const parent = coordinator.read(payload.input.projectId, payload.requestId)!;
    expect(parent.jobs.map((job) => [job.status, job.dispatchState])).toEqual([['ready', 'completed'], ['failed', 'not-dispatched'], ['outcome-unknown', 'may-have-dispatched']]);
    const reviewed = structuredClone(parent); reviewed.acceptedSceneIds = ['scene-1']; // UI acceptance cannot invalidate immutable provider lineage.
    expect(operationDigest(scopedShotRetryParentContent(reviewed))).toBe(operationDigest(scopedShotRetryParentContent(parent)));
    rejectSceneTwo = false;
    const retry = retryRequest(reviewed), initial = coordinator.start(retry, quote);
    expect(initial.jobs[0]).toEqual(parent.jobs[0]); expect(initial.jobs[2]).toEqual(parent.jobs[2]);
    expect(initial.jobs[1]).toMatchObject({ status: 'queued', attemptRequestId: retry.requestId, retryOfRunId: parent.jobs[1].runId });
    expect(initial.jobs[1].runId).not.toBe(parent.jobs[1].runId);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, retry.requestId)?.status).toBe('review'));
    const restored = new ScopedShotCoordinator(store, dispatch);
    expect(restored.read(payload.input.projectId, payload.requestId)?.successorRequestId).toBe(retry.requestId);
    const child = restored.read(payload.input.projectId, retry.requestId)!;
    expect(child.jobs.map((job) => job.status)).toEqual(['ready', 'ready', 'outcome-unknown']);
    expect(child.jobs[0]).toEqual(parent.jobs[0]); expect(child.jobs[2]).toEqual(parent.jobs[2]);
    expect(child).toMatchObject({ parentRequestId: parent.requestId, rootRequestId: parent.requestId, retrySceneIds: ['scene-2'] });
    expect(coordinator.start(retry, quote)).toEqual(child);
    expect(sent).toEqual(['scene-1', 'scene-3', 'scene-2']);
    expect(() => restored.start(retryRequest(parent), quote)).toThrow(/already continued/);
    expect(sent).toEqual(['scene-1', 'scene-3', 'scene-2']);
  });
  it('rejects ready, uncertain, legacy-without-proof, stale-source and wrong-parent retry manifests before dispatch', async () => {
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      if (scene.sceneId === 'scene-2') throw new ScopedShotNoDispatchError('No network attempted');
      if (scene.sceneId === 'scene-3') throw Error('Provider transport failed');
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    const { coordinator } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const parent = coordinator.read(payload.input.projectId, payload.requestId)!;
    expect(scopedShotRetryEligible({ ...parent.jobs[1], dispatchState: undefined })).toBe(false);
    expect(scopedShotRetryEligible({ ...parent.jobs[2], status: 'cancelled' })).toBe(false);
    for (const ids of [['scene-1'], ['scene-3'], ['scene-1', 'scene-2']]) expect(() => coordinator.start(retryRequest(parent, ids), quote)).toThrow(/proven not dispatched/);
    const retry = retryRequest(parent);
    for (const change of [
      { ...retry.retry, parentStateDigest: 'b'.repeat(64) },
      { ...retry.retry, parentRequestId: crypto.randomUUID() },
      { ...retry.retry, jobs: [{ ...retry.retry.jobs[0], runId: 'wrong-run' }] },
      { ...retry.retry, jobs: [{ ...retry.retry.jobs[0], sourceDigest: 'b'.repeat(64) }] },
    ]) expect(() => coordinator.start({ ...retry, retry: change, contentDigest: operationDigest(scopedShotApprovalContent(parent.input, quote.quoteId, change)) }, quote)).toThrow();
    const changedInput = structuredClone(parent.input); changedInput.scenes[1].brief.mustInclude.push('Unreviewed change');
    expect(() => coordinator.start({ ...retry, input: changedInput, contentDigest: operationDigest(scopedShotApprovalContent(changedInput, quote.quoteId, retry.retry)) }, quote)).toThrow(/original input/);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });
  it('fences an old coordinator before retrying cancelled unstarted jobs and recovers the successor without POST', async () => {
    let release!: () => void;
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      if (scene.sceneId === 'scene-1') { await new Promise<void>((resolve) => { release = resolve; }); throw Error('Potentially billed stop'); }
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    const { coordinator, store } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    const restored = new ScopedShotCoordinator(store, dispatch);
    const parent = restored.cancel(payload.input.projectId, payload.requestId);
    expect(parent.jobs.filter(scopedShotRetryEligible).map((job) => job.sceneId)).toEqual(['scene-2', 'scene-3']);
    const retry = retryRequest(parent); restored.start(retry, quote);
    release();
    await vi.waitFor(() => expect(restored.read(payload.input.projectId, retry.requestId)?.status).toBe('review'));
    expect(dispatch.mock.calls.map(([scene]) => scene.sceneId)).toEqual(['scene-1', 'scene-2', 'scene-3']);
    const afterReload = new ScopedShotCoordinator(store, dispatch);
    expect(afterReload.read(payload.input.projectId, payload.requestId)?.successorRequestId).toBe(retry.requestId);
    expect(afterReload.read(payload.input.projectId, retry.requestId)?.jobs.map((job) => job.status)).toEqual(['cancelled', 'ready', 'ready']);
  });
  it('requires fresh retry estimate/quote and refuses a provider-model change that would mix sibling provenance', async () => {
    const dispatch = vi.fn(async () => { throw new ScopedShotNoDispatchError('No provider entered'); });
    const { coordinator } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    const parent = coordinator.read(payload.input.projectId, payload.requestId)!, retry = retryRequest(parent, ['scene-2']);
    const repriced = { ...quote, perSceneEstimate: 0.1, quoteId: 'd'.repeat(64) };
    expect(() => coordinator.start(retry, repriced)).toThrow(/estimate/);
    const reviewed = { ...retry, quoteId: repriced.quoteId, approvedEstimate: 0.1, contentDigest: operationDigest(scopedShotApprovalContent(parent.input, repriced.quoteId, retry.retry)) };
    const changed = { ...repriced, model: 'another-provider-model' };
    expect(() => coordinator.start(reviewed, changed)).toThrow(/mode or model/);
    const created = coordinator.start(reviewed, repriced);
    expect(created.estimatedCost).toBe(0.1); expect(created.jobs.filter((job) => job.attemptRequestId === created.requestId)).toHaveLength(1);
    await vi.waitFor(() => expect(coordinator.read(parent.projectId, created.requestId)?.status).toBe('review'));
    expect(dispatch).toHaveBeenCalledTimes(4);
  });
  it('retains retry lineage and successful proposals through closed/reopened SQLite connections', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-scoped-retry-')), path = join(directory, 'operations.sqlite');
    let repository = await OperationRepository.open(path), reject = true;
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      if (scene.sceneId === 'scene-2' && reject) throw new ScopedShotNoDispatchError('Before provider');
      return runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
    });
    try {
      const first = new ScopedShotCoordinator(repository, dispatch), payload = request(); first.start(payload, quote);
      await vi.waitFor(() => expect(first.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
      const parent = first.read(payload.input.projectId, payload.requestId)!;
      repository.close(); repository = await OperationRepository.open(path);
      const second = new ScopedShotCoordinator(repository, dispatch); reject = false;
      const retry = retryRequest(second.read(parent.projectId, parent.requestId)!); second.start(retry, quote);
      await vi.waitFor(() => expect(second.read(parent.projectId, retry.requestId)?.status).toBe('review'));
      repository.close(); repository = await OperationRepository.open(path);
      const third = new ScopedShotCoordinator(repository, dispatch), root = third.read(parent.projectId, parent.requestId)!;
      expect(root.successorRequestId).toBe(retry.requestId);
      const child = third.read(parent.projectId, root.successorRequestId!)!;
      expect(child.jobs[0]).toEqual(parent.jobs[0]); expect(child.jobs[2]).toEqual(parent.jobs[2]);
      expect(child.jobs.every((job) => job.status === 'ready')).toBe(true); expect(dispatch).toHaveBeenCalledTimes(4);
    } finally { repository.close(); await rm(directory, { recursive: true, force: true }); }
  });
  it('rejects fabricated continuity reuse before ready and again on saved-state validation', async () => {
    const dispatch = vi.fn(async (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal) => {
      const result = await runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), signal, runId);
      const character = Object.values(result.cinema.characters)[0];
      character.continuityBinding = { version: 1, kind: 'character', entityId: 'unreviewed-person', nodeId: 'unreviewed-layer', sourceIdentity: 'not-in-reviewed-catalog' };
      return result;
    });
    const { coordinator } = await service(dispatch), payload = request(); coordinator.start(payload, quote);
    await vi.waitFor(() => expect(coordinator.read(payload.input.projectId, payload.requestId)?.status).toBe('review'));
    expect(coordinator.read(payload.input.projectId, payload.requestId)?.jobs.every((job) => job.status === 'outcome-unknown' && !job.result)).toBe(true);
  });
});
