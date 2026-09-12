// @vitest-environment jsdom
import { createElement } from 'react';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { workflowCapabilities } from '../../server/cinema/workflow-capabilities';
import { capabilityDescription, type WorkflowCapabilities } from '../story-development/workflow-capabilities';
import { workspaceFeature } from './WorkspaceFeatureStatus';
import { VisualPreproductionPanel } from '../storyboard/VisualPreproductionPanel';
import { VideoPreproductionPanel } from '../video/VideoPreproductionPanel';
import { SequenceReview } from '../assembly/SequenceReview';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { acceptCinemaPlanRevision } from '../../domain/cinema/project-data';
import type { CinemaVisualPreproductionData } from '../../domain/cinema/visual-preproduction';
import { loadLocalMediaBlob, saveLocalMediaBlob, type LocalMediaBlob } from '../../editor/persistence';
import { OPERATION_JOURNAL_KEY } from './operation-journal';

vi.mock('../../editor/persistence', () => ({ loadLocalMediaBlob: vi.fn(), saveLocalMediaBlob: vi.fn() }));
// Admission tests control async preparation; crypto itself is covered by the
// existing digest/server tests and the built-browser suite.
vi.mock('../../domain/cinema/request-digest', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../domain/cinema/request-digest')>(),
  requestDigest: async () => 'a'.repeat(64),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const fixture = () => workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' });
const videoQuote = { ok: true, mode: 'fixture', version: 1, ready: true, blockers: [], quoteId: 'a'.repeat(64), usdPerSecond: 0, maximumEstimatedUsd: 0,
  capability: { provider: 'fixture', model: 'fixture', version: '1', supportsEndFrame: true, supportsReferenceImages: false, supportsAudio: false,
    durations: [4, 6, 8], aspectRatios: ['9:16', '16:9'], resolutions: ['720p', '1080p'], maxOutputs: 1 } };
function media(): LocalMediaBlob { return { hash: 'a'.repeat(64), blob: new Blob(['pixels'], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1, byteSize: 6, createdAt: 0 }; }
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:fixture'; } static revokeObjectURL() {} });
  vi.stubGlobal('FileReader', class {
    result = 'data:image/png;base64,cGl4ZWxz';
    onload: (() => void) | null = null;
    readAsDataURL() { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    if (!this.getAttribute('src')) return;
    Object.defineProperty(this, 'duration', { configurable: true, value: 8 });
    queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
  });
  vi.mocked(loadLocalMediaBlob).mockReset().mockResolvedValue(media());
  vi.mocked(saveLocalMediaBlob).mockReset().mockResolvedValue(media());
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => options?.method === 'POST'
    ? Response.json({ ok: false, error: { message: 'Intercepted POST' } }, { status: 400 })
    : Response.json(videoQuote)));
});
function source() {
  const incoming = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  for (const run of Object.values(incoming.agentRuns)) run.status = 'ready';
  const cinema = acceptCinemaPlanRevision(undefined, incoming, '2026-09-11T00:00:00Z');
  const scene = cinema.scenes[cinema.sceneOrder[0]];
  scene.shotIds = [scene.shotIds[0]];
  const shot = cinema.shots[scene.shotIds[0]];
  const revision = Object.values(cinema.revisions).find((value) => value.sceneId === scene.id && value.status === 'active')!;
  const prompt = Object.values(cinema.prompts).find((value) => value.ownerNodeId === shot.nodeId && value.purpose === 'storyboard')!;
  cinema.visualPreproduction!.references.ref = { id: 'ref', sceneId: scene.id, title: 'Owned image', type: 'character', origin: 'upload',
    mimeType: 'image/png', width: 1, height: 1, byteSize: 6, blobHash: 'a'.repeat(64), sourceUrl: null, provenance: 'local', rightsStatus: 'creator-owned',
    allowedUses: ['image-generation'], approvalStatus: 'approved', notes: '', shotIds: [shot.id], pinned: false, createdAt: '2026-09-11T00:00:00Z' };
  const frame = { id: 'anchor', runId: 'image-run', shotId: shot.id, revisionId: revision.id, promptId: prompt.id, promptVersion: prompt.version,
    promptText: prompt.generatedText, referenceIds: [], provider: 'fixture', model: 'fixture', aspectRatio: '9:16' as const, seed: 1, variantIndex: 0,
    intent: 'balanced' as const, blobHash: 'a'.repeat(64), mimeType: 'image/png' as const, width: 1, height: 1, byteSize: 6,
    safetyStatus: 'passed' as const, status: 'approved' as const, estimatedCost: 0, currency: 'USD' as const, createdAt: '2026-09-11T00:00:00Z' };
  return { cinema, shot, frame, revision };
}
function mount(kind: 'images' | 'video', initial: WorkflowCapabilities | null = fixture()) {
  const data = source();
  let cinema = data.cinema, capabilities = initial, writes = 0, documentEpoch = 0;
  if (kind === 'video') cinema.visualPreproduction!.storyboardFrames.anchor = data.frame;
  const onNotice = vi.fn();
  const onUpdate = (update: (current: CinemaVisualPreproductionData) => CinemaVisualPreproductionData) => {
    writes++;
    cinema = { ...cinema, visualPreproduction: update(cinema.visualPreproduction!) }; view.rerender(element());
  };
  const element = () => kind === 'images'
    ? createElement(VisualPreproductionPanel, { key: documentEpoch, cinema, shot: data.shot, sceneId: data.shot.sceneId, accepted: true, capabilities, canvasImages: [], onCleanupMedia: vi.fn(), onUpdate, onNotice })
    : createElement(VideoPreproductionPanel, { key: documentEpoch, cinema, shot: data.shot, capabilities, onUpdate, onNotice });
  const view = render(element());
  return { ...view, onNotice, get: () => cinema, writes: () => writes,
    replaceProject: () => { cinema = { ...structuredClone(data.cinema), projectId: 'replacement-project' }; view.rerender(element()); },
    replaceSameProject: () => { cinema = structuredClone(data.cinema); documentEpoch++; view.rerender(element()); },
    replace: (value: WorkflowCapabilities | null) => { capabilities = value; view.rerender(element()); },
    confirm: () => screen.getByRole('checkbox', { name: kind === 'images' ? /I confirm the/ : /I confirm one/ }),
    generate: () => screen.getByRole('button', { name: kind === 'images' ? 'Generate storyboard' : 'Generate one clip' }),
  };
}
const posts = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST');

it('a lost video POST response observes the same ID and disposes without redispatch on refresh or unmount', async () => {
  let release!: (value: Response) => void; let signal: AbortSignal | null | undefined;
  vi.mocked(fetch).mockImplementation(async (url, options) => {
    if (options?.method === 'POST') throw Error('Connection lost after dispatch');
    if (new URL(String(url), 'http://localhost').searchParams.has('operationId')) {
      signal = options?.signal;
      return new Promise(resolve => { release = resolve; });
    }
    return Response.json(videoQuote);
  });
  let t!: ReturnType<typeof mount>;
  await act(async () => { t = mount('video'); });
  await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(t.confirm()); fireEvent.click(t.generate()); });
  await waitFor(() => expect(release).toBeTypeOf('function'));
  const id = JSON.parse(String(posts()[0][1]?.body)).idempotencyKey;
  expect(t.get().visualPreproduction?.videoOperations[id]).toMatchObject({ status: 'queued', completedAt: null, error: expect.stringContaining('Outcome unknown') });
  expect(screen.getByRole('status').textContent).toContain('checking existing request');
  const reads = () => vi.mocked(fetch).mock.calls.filter(([url]) => new URL(String(url), 'http://localhost').searchParams.has('operationId'));
  expect(reads()).toHaveLength(1);
  expect(new URL(String(reads()[0][0]), 'http://localhost').searchParams.get('operationId')).toBe(id);
  await act(async () => t.replace(null));
  expect(reads()).toHaveLength(1); expect(posts()).toHaveLength(1);
  const writes = t.writes(); t.unmount(); expect(signal?.aborted).toBe(true);
  await act(async () => release(Response.json({ ok: false })));
  expect(t.writes()).toBe(writes); expect(posts()).toHaveLength(1);
});

for (const kind of ['images', 'video'] as const) it(`${kind} cannot adopt after project replacement while returned bytes are saving`, async () => {
  let release!: (value: LocalMediaBlob) => void;
  vi.mocked(saveLocalMediaBlob).mockImplementation(() => new Promise(resolve => { release = resolve; }));
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    const observedId = new URL(String(_url), 'http://localhost').searchParams.get('operationId');
    if (options?.method !== 'POST' && !observedId) return Response.json(videoQuote);
    if (kind === 'images') return Response.json({ ok: true, provider: 'fixture', model: 'fixture', estimatedCost: 0, currency: 'USD',
      frames: [{ id: 'late-frame', variantIndex: 0, seed: 1, mimeType: 'image/svg+xml', base64: btoa('<svg/>'), width: 1, height: 1, safetyStatus: 'passed' }] });
    const operationId = observedId ?? JSON.parse(String(options?.body)).idempotencyKey;
    return Response.json({ ok: true, version: 1, mode: 'fixture', operation: { operationId,
      providerOperationId: 'fixture-handle', status: 'ready', provider: 'fixture', model: 'fixture',
      capability: { version: '1', provider: 'fixture', model: 'fixture', supportsEndFrame: true, supportsReferenceImages: false, supportsAudio: false },
      estimatedCost: 0, currency: 'USD', error: null, cancellationNote: null,
      clip: { id: 'late-clip', mimeType: 'video/mp4', base64: 'Ynl0ZXM=', width: 160, height: 90, byteSize: 5, durationSeconds: 1 } } });
  });
  let t!: ReturnType<typeof mount>;
  await act(async () => { t = mount(kind); });
  await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(t.confirm()); fireEvent.click(t.generate()); });
  await waitFor(() => expect(release).toBeTypeOf('function'));
  const writes = t.writes();
  await act(async () => t.replaceProject());
  await act(async () => release(media()));
  expect(t.get().projectId).toBe('replacement-project');
  expect(t.get().visualPreproduction?.storyboardFrames['late-frame']).toBeUndefined();
  expect(t.get().visualPreproduction?.videoClips['late-clip']).toBeUndefined();
  expect(t.writes()).toBe(writes); expect(posts()).toHaveLength(1);
});

for (const kind of ['images', 'video'] as const) it(`${kind} cannot adopt after a same-project-ID document replacement while returned bytes are saving`, async () => {
  let release!: (value: LocalMediaBlob) => void;
  vi.mocked(saveLocalMediaBlob).mockImplementation(() => new Promise(resolve => { release = resolve; }));
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    const observedId = new URL(String(_url), 'http://localhost').searchParams.get('operationId');
    if (options?.method !== 'POST' && !observedId) return Response.json(videoQuote);
    if (kind === 'images') return Response.json({ ok: true, provider: 'fixture', model: 'fixture', estimatedCost: 0, currency: 'USD',
      frames: [{ id: 'same-id-late-frame', variantIndex: 0, seed: 1, mimeType: 'image/svg+xml', base64: btoa('<svg/>'), width: 1, height: 1, safetyStatus: 'passed' }] });
    const operationId = observedId ?? JSON.parse(String(options?.body)).idempotencyKey;
    return Response.json({ ok: true, version: 1, mode: 'fixture', operation: { operationId,
      providerOperationId: 'fixture-handle', status: 'ready', provider: 'fixture', model: 'fixture',
      capability: { version: '1', provider: 'fixture', model: 'fixture', supportsEndFrame: true, supportsReferenceImages: false, supportsAudio: false },
      estimatedCost: 0, currency: 'USD', error: null, cancellationNote: null,
      clip: { id: 'same-id-late-clip', mimeType: 'video/mp4', base64: 'Ynl0ZXM=', width: 160, height: 90, byteSize: 5, durationSeconds: 1 } } });
  });
  let t!: ReturnType<typeof mount>;
  await act(async () => { t = mount(kind); });
  await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(t.confirm()); fireEvent.click(t.generate()); });
  await waitFor(() => expect(release).toBeTypeOf('function'));
  const writes = t.writes();
  await act(async () => t.replaceSameProject());
  await act(async () => release(media()));
  expect(t.get().projectId).toBe(source().cinema.projectId);
  expect(t.get().visualPreproduction?.storyboardFrames['same-id-late-frame']).toBeUndefined();
  expect(t.get().visualPreproduction?.videoClips['same-id-late-clip']).toBeUndefined();
  expect(t.writes()).toBe(writes); expect(posts()).toHaveLength(1);
});

for (const feature of ['images', 'video', 'assembly'] as const) it(`${feature} derives unknown, blocked and review-required status from discovery`, () => {
  expect(workspaceFeature(null, feature).canReview).toBe(false);
  const value = fixture();
  expect(workspaceFeature(value, feature).canReview).toBe(true);
  expect(workspaceFeature(value, feature).description).toBe(capabilityDescription(value.stages[feature]));
  value.stages[feature] = { ...value.stages[feature], status: 'blocked', ready: false, blockers: ['Test policy blocks this feature.'] };
  expect(workspaceFeature(value, feature)).toMatchObject({ canReview: false, label: 'Blocked', description: 'Test policy blocks this feature.' });
});

for (const kind of ['images', 'video'] as const) {
  it(`${kind} fails closed before POST when durable client intent cannot be read`, async () => {
    const t = mount(kind);
    await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
    localStorage.setItem(OPERATION_JOURNAL_KEY, '{');
    await act(async () => { fireEvent.click(t.confirm()); fireEvent.click(t.generate()); });
    await waitFor(() => expect(t.onNotice).toHaveBeenCalledWith(expect.stringContaining('operation recovery data is unreadable'), 'error'));
    expect(posts()).toHaveLength(0);
  });
  it(`${kind} blocks unknown workspace without a preflight or POST`, async () => {
    const t = mount(kind, null);
    expect((t.generate() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('region', { name: kind === 'images' ? 'Reference images workspace status' : 'Video generation workspace status' }).textContent).toContain('Unknown');
    await act(async () => {}); expect(fetch).not.toHaveBeenCalled();
  });
  it(`${kind} clears consent on same-mode discovery replacement`, async () => {
    const t = mount(kind);
    await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(t.confirm()); expect((t.generate() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => t.replace(fixture()));
    expect((t.confirm() as HTMLInputElement).checked).toBe(false);
    expect((t.generate() as HTMLButtonElement).disabled).toBe(true); expect(posts()).toHaveLength(0);
  });
  for (const change of ['unknown', 'same-mode', 'blocked', 'unmount'] as const) it(`${kind} rejects ${change} during media preparation before POST`, async () => {
    let release!: (value: LocalMediaBlob) => void;
    vi.mocked(loadLocalMediaBlob).mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const t = mount(kind);
    await waitFor(() => expect((t.confirm() as HTMLInputElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(t.confirm()); fireEvent.click(t.generate()); });
    await waitFor(() => expect(release).toBeTypeOf('function'));
    const replacement = fixture();
    if (change === 'blocked') replacement.stages[kind] = { ...replacement.stages[kind], status: 'blocked', ready: false, blockers: ['Policy changed.'] };
    const writes = t.writes();
    await act(async () => change === 'unmount' ? t.unmount() : t.replace(change === 'unknown' ? null : replacement));
    await act(async () => {
      release(media());
      if (change !== 'unmount') await vi.waitFor(() => expect(t.onNotice).toHaveBeenCalledWith(expect.stringMatching(/Workspace status changed|scope changed|settings changed/), 'error'));
    });
    expect(posts()).toHaveLength(0);
    if (change === 'unmount') expect(t.writes()).toBe(writes);
  });
}

it('already dispatched images remain reviewable after discovery becomes unknown', async () => {
  let release!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === 'POST'
    ? new Promise((resolve) => { release = resolve; }) : Response.json(videoQuote));
  const t = mount('images'); await act(async () => {
    fireEvent.click(t.confirm()); fireEvent.click(t.generate());
    await vi.waitFor(() => expect(posts()).toHaveLength(1));
  });
  await act(async () => t.replace(null));
  await act(async () => {
    release(Response.json({ ok: true, provider: 'fixture', model: 'fixture', estimatedCost: 0, currency: 'USD',
      frames: [{ id: 'returned-frame', variantIndex: 0, seed: 1, mimeType: 'image/svg+xml', base64: btoa('<svg/>'), width: 1, height: 1, safetyStatus: 'passed' }] }));
    await vi.waitFor(() => expect(t.get().visualPreproduction?.storyboardFrames['returned-frame']?.status).toBe('candidate'));
  });
  expect(posts()).toHaveLength(1);
});

function cut() {
  const { cinema, shot, frame, revision } = source();
  cinema.visualPreproduction!.storyboardFrames.anchor = frame;
  const prompt = Object.values(cinema.prompts).find((value) => value.ownerNodeId === shot.nodeId && value.purpose === 'video')!;
  cinema.visualPreproduction!.videoClips.take = { id: 'take', operationId: 'video-run', shotId: shot.id, revisionId: revision.id, promptId: prompt.id,
    promptVersion: prompt.version, startFrameId: frame.id, endFrameId: null, referenceIds: [], capabilityProfileVersion: '1', provider: 'fixture', model: 'fixture', settings: { aspectRatio: '9:16', durationSeconds: 8, resolution: '720p', audio: false, outputCount: 1, seed: null },
    blobHash: 'b'.repeat(64), mimeType: 'video/mp4', width: 720, height: 1280, byteSize: 6, durationSeconds: 8, status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: frame.createdAt };
  return cinema;
}
for (const change of ['unknown', 'same-mode', 'sequence', 'unmount'] as const) it(`Final Cut rejects ${change} during fresh preflight before uploading clips`, async () => {
  let release!: (response: Response) => void; let gets = 0;
  vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === 'POST' ? Response.json({ error: 'Unexpected POST' })
    : ++gets === 1 ? Response.json({ available: true, token: 'local-token', reason: null }) : new Promise((resolve) => { release = resolve; }));
  let cinema = cut(); const onNotice = vi.fn(); let capabilities: WorkflowCapabilities | null = fixture();
  const element = () => createElement(SequenceReview, { cinema, capabilities, onNotice });
  const view = render(element());
  const button = screen.getByRole('button', { name: 'Render silent MP4 locally' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button);
  await waitFor(() => expect(release).toBeTypeOf('function'));
  const originalRelease = release;
  act(() => { if (change === 'unmount') view.unmount(); else {
    if (change === 'sequence') { cinema = structuredClone(cinema); Object.values(cinema.shots)[0].durationSeconds += 1; }
    else capabilities = change === 'unknown' ? null : fixture();
    view.rerender(element());
  } });
  await act(async () => originalRelease(Response.json({ available: true, token: 'local-token', reason: null })));
  expect(posts()).toHaveLength(0);
  expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/Workspace status changed|sequence changed|cancelled/), expect.any(String));
});

it('Final Cut refuses malformed preflight even with reviewable discovery', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ available: 'yes', token: 'not-proof', reason: null }));
  render(createElement(SequenceReview, { cinema: cut(), capabilities: fixture(), onNotice: vi.fn() }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('preflight is unavailable'));
  expect((screen.getByRole('button', { name: 'Render silent MP4 locally' }) as HTMLButtonElement).disabled).toBe(true);
  expect(posts()).toHaveLength(0);
});

it('a dispatched local render survives discovery refresh and still requires downloading', async () => {
  let release!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === 'POST'
    ? new Promise((resolve) => { release = resolve; }) : Response.json({ available: true, token: 'local-token', reason: null }));
  const cinema = cut(), onNotice = vi.fn();
  const view = render(createElement(SequenceReview, { cinema, capabilities: fixture(), onNotice }));
  const button = screen.getByRole('button', { name: 'Render silent MP4 locally' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button);
  await waitFor(() => expect(posts()).toHaveLength(1));
  act(() => view.rerender(createElement(SequenceReview, { cinema, capabilities: null, onNotice })));
  await act(async () => release(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'video/mp4' } })));
  expect(screen.getByRole('link', { name: 'Download verified MP4' })).toBeTruthy();
  expect(screen.getByText('Download to keep this export. It is not stored in the project backup.')).toBeTruthy();
  expect(posts()).toHaveLength(1);
});
