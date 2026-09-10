// @vitest-environment jsdom
import { createElement } from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantShotPlanning } from './AssistantShotPlanning';
import { initialDocument } from '../../editor/initial-document';
import { ensureStoryProject, changeStory, setStorySceneAllocation } from '../../editor/story-development-commands';
import { buildScopedShotInput } from '../../editor/scoped-shot-commands';
import type { ScopedShotState } from '../../domain/cinema/scoped-shot-planning';
import type { EditorDocument } from '../../editor/types';
import { richTextFromPlainText } from '../../editor/rich-text';
import { applyCinemaDomainCommand } from '../../editor/cinema-domain-commands';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from '../../server/cinema/workflow';

vi.mock('../assembly/SequenceReview', () => ({ SequenceReview: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function source(sceneCount = 1) {
  vi.stubGlobal('crypto', webcrypto);
  let document = setStorySceneAllocation(ensureStoryProject(structuredClone(initialDocument)), 'scene-01', 20);
  const host = document.nodes.find((node) => node.id === 'scene-01')!;
  if (host.data.kind === 'concept') host.data.body = richTextFromPlainText('Four friends escape a cursed board game together.');
  if (sceneCount === 2) {
    document = applyCinemaDomainCommand(document, { type: 'add-scenes', scenes: [{ id: 'scene-02', title: 'The escape', synopsis: 'Everyone leaves the game together.', dramaticPurpose: 'Resolve the story' }] });
    document = setStorySceneAllocation(document, 'scene-02', 20);
  }
  const input = await buildScopedShotInput(document, document.cinema!.sceneOrder);
  const state: ScopedShotState = { version: 1, requestId: crypto.randomUUID(), projectId: input.projectId, input, inputDigest: 'a'.repeat(64), quoteId: 'b'.repeat(64),
    mode: 'fixture', model: 'fixture-planner-v1', estimatedCost: 0, actualCost: null, status: 'running', acceptedSceneIds: [],
    jobs: input.scenes.map((scene) => ({ sceneId: scene.sceneId, title: scene.title, runId: crypto.randomUUID(), sourceDigest: scene.sourceDigest, status: 'queued', result: null, error: null })) };
  document = changeStory(document, (workflow) => { workflow.shotPlanning = state; });
  return { document, state };
}
function mount(initial: EditorDocument) {
  let current = initial;
  const props = () => ({ document: current, getDocument: () => current, commit: (next: EditorDocument) => { current = next; view.rerender(createElement(AssistantShotPlanning, props())); },
    flush: async () => undefined, providerMode: 'fixture' as const, onOpenLayer: vi.fn() });
  const view = render(createElement(AssistantShotPlanning, props()));
  return { get: () => current, replace: (next: EditorDocument) => { current = next; view.rerender(createElement(AssistantShotPlanning, props())); } };
}
describe('Assistant scoped operation UI safety', () => {
  it('marks cancellation locally before the server response and does not resurrect a replaced operation', async () => {
    const { document, state } = await source();
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const harness = mount(document);
    fireEvent.click(screen.getByRole('button', { name: 'Stop planning' }));
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.status).toBe('cancelled');
    const finishOriginalCancellation = finish;
    const replacement = { ...state, requestId: crypto.randomUUID() };
    act(() => harness.replace(changeStory(harness.get(), (workflow) => { workflow.shotPlanning = replacement; })));
    await act(async () => finishOriginalCancellation(Response.json({ ok: true, state: { ...state, status: 'cancelled' } })));
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.requestId).toBe(replacement.requestId);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.status).toBe('running');
  });
  it('keeps cancellation local when the provider cannot confirm it', async () => {
    const { document } = await source();
    vi.stubGlobal('fetch', vi.fn(async () => { throw Error('Offline: provider cancellation unconfirmed.'); }));
    const harness = mount(document);
    fireEvent.click(screen.getByRole('button', { name: 'Stop planning' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Offline/));
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.status).toBe('cancelled');
    expect(screen.queryByRole('button', { name: 'Stop planning' })).toBeNull();
  });
  it('never starts a provider call just by opening an empty scope', async () => {
    const { document } = await source();
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const empty = changeStory(document, (workflow) => { delete workflow.shotPlanning; });
    mount(empty);
    expect((screen.getByRole('button', { name: 'Plan shots' }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reviews only proven unstarted scenes and keeps the successful parent after a pre-dispatch rejection', async () => {
    const { document, state } = await source(2);
    const first = state.input.scenes[0];
    state.jobs[0] = { ...state.jobs[0], status: 'ready', dispatchState: 'completed', result: await runCinemaPlanningWorkflow(first.brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, state.jobs[0].runId, first.planningContext) };
    state.jobs[1] = { ...state.jobs[1], status: 'failed', dispatchState: 'not-dispatched', error: 'Policy changed before dispatch.' };
    state.status = 'review';
    const initial = changeStory(document, (workflow) => { workflow.shotPlanning = state; });
    const posts: Record<string, unknown>[] = [];
    const quote = { version: 1, mode: 'fixture', model: 'fixture-planner-v1', quoteId: 'b'.repeat(64), ready: true, blockers: [], perSceneEstimate: 0, ceiling: 1, maxScenes: 10, maxAttemptsPerScene: 1 };
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        posts.push(JSON.parse(String(options.body)));
        return Response.json({ ok: false, error: 'Quote changed before dispatch.', dispatchCertainty: 'not-dispatched' }, { status: 400 });
      }
      return Response.json(url.includes('?') ? { ok: true, state } : { ok: true, quote });
    }));
    const harness = mount(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Review retry for 1 scenes' }));
    await screen.findByRole('button', { name: 'Approve retry for 1 scenes' });
    expect(posts).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Approve retry for 1 scenes' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Quote changed/));
    expect(posts).toHaveLength(1);
    expect((posts[0].retry as { jobs: { sceneId: string }[] }).jobs.map((job) => job.sceneId)).toEqual(['scene-02']);
    expect(posts[0].approvedEstimate).toBe(0);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning).toEqual(state);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanningHistory ?? []).toHaveLength(0);
    expect(harness.get().nodes).toEqual(initial.nodes);
  });
  it('never offers uncertain or legacy unproven jobs as retryable', async () => {
    const { document, state } = await source(2);
    state.status = 'outcome-unknown';
    state.jobs[0] = { ...state.jobs[0], status: 'outcome-unknown', dispatchState: 'may-have-dispatched' };
    state.jobs[1] = { ...state.jobs[1], status: 'failed' };
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    mount(changeStory(document, (workflow) => { workflow.shotPlanning = state; }));
    expect(screen.queryByRole('region', { name: 'Retry unstarted scenes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Check saved status' })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('recovers a successful retry, preserves accepted siblings, and reopens the parent locally', async () => {
    const { document, state } = await source(2);
    const first = state.input.scenes[0], second = state.input.scenes[1];
    state.jobs[0] = { ...state.jobs[0], status: 'ready', dispatchState: 'completed', result: await runCinemaPlanningWorkflow(first.brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, state.jobs[0].runId, first.planningContext) };
    state.jobs[1] = { ...state.jobs[1], status: 'failed', dispatchState: 'not-dispatched', error: 'Not dispatched.' };
    state.status = 'review'; state.acceptedSceneIds = ['scene-01'];
    const initial = changeStory(document, (workflow) => { workflow.shotPlanning = state; });
    const secondRunId = crypto.randomUUID();
    const result = await runCinemaPlanningWorkflow(second.brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, secondRunId, second.planningContext);
    let child: ScopedShotState | undefined;
    let posts = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        posts++;
        const request = JSON.parse(String(options.body));
        child = { ...state, requestId: request.requestId, parentRequestId: state.requestId, rootRequestId: state.requestId,
          parentStateDigest: request.retry.parentStateDigest, retrySceneIds: ['scene-02'], inputDigest: request.contentDigest, acceptedSceneIds: [],
          jobs: [state.jobs[0], { ...state.jobs[1], status: 'ready', dispatchState: 'completed', result, error: null, runId: secondRunId, retryOfRunId: state.jobs[1].runId, attemptRequestId: request.requestId }] };
        return Response.json({ ok: true, state: child });
      }
      if (!url.includes('?')) return Response.json({ ok: true, quote: { version: 1, mode: 'fixture', model: 'fixture-planner-v1', quoteId: 'b'.repeat(64), ready: true, blockers: [], perSceneEstimate: 0, ceiling: 1, maxScenes: 10, maxAttemptsPerScene: 1 } });
      return Response.json({ ok: true, state: child && url.includes(child.requestId) ? child : state });
    });
    vi.stubGlobal('fetch', fetchMock);
    const harness = mount(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Review retry for 1 scenes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve retry for 1 scenes' }));
    await waitFor(() => expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.jobs[1].status).toBe('ready'), { timeout: 2500 });
    expect(posts).toBe(1);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.jobs[0]).toEqual(state.jobs[0]);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.acceptedSceneIds).toEqual(['scene-01']);
    expect(harness.get().nodes).toEqual(initial.nodes);
    const callsBeforeReopen = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(state.requestId.slice(0, 8)) }));
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.requestId).toBe(state.requestId);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanningHistory![0].requestId).toBe(child!.requestId);
    expect(fetchMock.mock.calls).toHaveLength(callsBeforeReopen);
  });
  it('rejects a poll checkpoint with a different operation identity', async () => {
    const { document, state } = await source();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, state: { ...state, requestId: crypto.randomUUID() } })));
    const harness = mount(document);
    await screen.findByText('Saved operation identity mismatch. Nothing was applied or restarted.');
    expect(harness.get()).toEqual(document);
  });
  it('follows a saved retry chain using only GETs and rejects cycles', async () => {
    const { document, state } = await source();
    state.status = 'review';
    const lineage = { rootRequestId: state.requestId, parentStateDigest: 'c'.repeat(64), retrySceneIds: ['scene-01'] };
    const second = { ...state, ...lineage, requestId: crypto.randomUUID(), parentRequestId: state.requestId };
    const third = { ...state, ...lineage, requestId: crypto.randomUUID(), parentRequestId: second.requestId };
    state.successorRequestId = second.requestId; second.successorRequestId = third.requestId;
    const checkpoints = [state, second, third];
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(options?.method ?? 'GET').toBe('GET');
      return Response.json({ ok: true, state: checkpoints.find((item) => url.includes(item.requestId)) });
    }); vi.stubGlobal('fetch', fetchMock);
    const harness = mount(changeStory(document, (workflow) => { workflow.shotPlanning = state; }));
    fireEvent.click(screen.getByRole('button', { name: 'Check saved status' }));
    await waitFor(() => expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.requestId).toBe(third.requestId));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    third.successorRequestId = second.requestId;
    second.parentRequestId = third.requestId;
    fireEvent.click(screen.getByRole('button', { name: 'Check saved status' }));
    await screen.findByText('Saved retry history is invalid or exceeds the recovery limit. Nothing was restarted.');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  it('labels a first-attempt rejection as not started, not an uncertain provider outcome', async () => {
    const { document } = await source();
    const empty = changeStory(document, (workflow) => { delete workflow.shotPlanning; });
    const posts: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { posts.push(options.body); return Response.json({ ok: false, error: 'Fresh quote required.', dispatchCertainty: 'not-dispatched' }, { status: 400 }); }
      return Response.json({ ok: true, quote: { version: 1, mode: 'fixture', model: 'fixture-planner-v1', quoteId: 'b'.repeat(64), ready: true, blockers: [], perSceneEstimate: 0, ceiling: 1, maxScenes: 10, maxAttemptsPerScene: 1 } });
    }));
    const harness = mount(empty);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Scene 01' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan shots' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create 1 fixture plans' }));
    await screen.findByText('Fresh quote required.');
    expect(posts).toHaveLength(1);
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.status).toBe('review');
    expect(harness.get().cinema!.storyWorkflow!.shotPlanning!.jobs[0].status).toBe('failed');
    expect(harness.get().nodes).toEqual(empty.nodes);
  });
});
