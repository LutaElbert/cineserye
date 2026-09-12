import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateVideoRequest, VideoOperationResponse, VideoPreflightResponse } from '../../../features/video/video-api';
import { ownedVideoOperationUrl, videoApprovalContent } from '../../../features/video/video-api';
import { operationDigest } from '../../../server/cinema/operation-repository';
import { ConfirmedVideoFailure, FixtureVideoProvider, VertexVideoProvider } from '../../../server/cinema/video-provider';
import { DELETE, GET, POST } from './route';
import { localVideoOperationStore } from '../../../server/cinema/video-operation-store';
import { FIXTURE_VIDEO_CAPABILITIES } from '../../../server/cinema/video-capabilities';

let testProject = 'project-1';
function payload(id: string): GenerateVideoRequest {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxWQAAAAASUVORK5CYII=';
  return {
    version: 1,
    idempotencyKey: id,
    shotId: 'shot-1',
    revisionId: 'revision-1',
    projectId: testProject, sceneId: 'scene-1',
    acceptedPlan: true,
    prompt: { id: 'video-prompt-1', version: 1, text: 'Slow push toward the auditorium screen.', purpose: 'video', negativeConstraints: ['No extra people'], status: 'approved' },
    startFrame: { id: 'frame-1', status: 'approved', mimeType: 'image/png', base64: png, byteSize: Buffer.from(png, 'base64').length },
    endFrame: null,
    referenceIds: [],
    settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    explicitConfirmation: true,
    liveProviderConsent: false,
  };
}

async function start(request: GenerateVideoRequest) {
  const preflight = await (await GET(new Request('http://localhost/api/cinema/generate-video'))).json() as Extract<VideoPreflightResponse, { ok: true }>;
  return dispatch({ ...request, approval: { quoteId: preflight.quoteId, contentDigest: operationDigest(videoApprovalContent(request, preflight.quoteId)) } });
}

async function dispatch(request: GenerateVideoRequest) {
  return POST(new Request('http://localhost/api/cinema/generate-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify(request),
  }));
}

async function poll(id: string, reconcile = false) {
  const response = await GET(new Request(`${ownedUrl(id)}${reconcile ? '&reconcile=1' : ''}`));
  return response.json() as Promise<VideoOperationResponse>;
}
function ownedUrl(id: string) { return `http://localhost${ownedVideoOperationUrl({ operationId: id, projectId: testProject, sceneId: 'scene-1', shotId: 'shot-1', revisionId: 'revision-1' })}`; }

beforeEach(() => { testProject = `project-${crypto.randomUUID()}`; vi.stubEnv('CINESERYE_VIDEO_OPERATION_DB_PATH', ':memory:'); });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR;
});

describe('video operation route', () => {
  it('only explicit reconciliation renews the observation window, never the provider start time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    const id = 'video-observation-window', store = await localVideoOperationStore();
    const owner = { projectId: testProject, sceneId: 'scene-1', shotId: 'shot-1', revisionId: 'revision-1', operationId: id };
    const dispatchSpy = vi.fn(async () => ({ name: 'original-handle', startedAt: 1000 }));
    await store.start({ version: 1, owner, digest: operationDigest('window-test'), mode: 'live',
      provider: { id: 'google-vertex-ai', model: 'model', project: 'project', location: 'region' },
      capability: FIXTURE_VIDEO_CAPABILITIES, settings: payload(id).settings, handle: { name: '', startedAt: 1000 },
      status: 'queued', estimatedCost: 1, currency: 'USD', error: null, clip: null }, dispatchSpy);
    const providerPoll = vi.spyOn(VertexVideoProvider.prototype, 'poll').mockImplementation(async handle => ({ handle, status: 'running', clip: null }));
    vi.setSystemTime(1000 + 16 * 60 * 1000);
    expect(await poll(id)).toMatchObject({ operation: { status: 'unknown' } });
    expect(await poll(id)).toMatchObject({ operation: { status: 'unknown' } });
    expect(providerPoll).not.toHaveBeenCalled();
    const resumed = await GET(new Request(`${ownedUrl(id)}&reconcile=1`));
    expect(await resumed.json()).toMatchObject({ operation: { status: 'running' } });
    vi.setSystemTime(1000 + 17 * 60 * 1000);
    expect(await poll(id)).toMatchObject({ operation: { status: 'running' } });
    expect(providerPoll).toHaveBeenCalledTimes(2);
    vi.setSystemTime(1000 + 32 * 60 * 1000);
    expect(await poll(id)).toMatchObject({ operation: { status: 'unknown' } });
    expect(providerPoll).toHaveBeenCalledTimes(2);
    expect(store.read(owner).handle).toEqual({ name: 'original-handle', startedAt: 1000 });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
  it('a poll transport failure stays unknown and can reconcile the same handle without another start', async () => {
    const dispatchSpy = vi.spyOn(FixtureVideoProvider.prototype, 'start');
    const id = 'video-poll-unknown-1';
    await start(payload(id));
    const pollSpy = vi.spyOn(FixtureVideoProvider.prototype, 'poll').mockRejectedValueOnce(Error('Network down'));
    expect(await poll(id)).toMatchObject({ ok: true, operation: { status: 'unknown', clip: null } });
    const returned = await poll(id, true);
    expect(returned).toMatchObject({ ok: true, operation: { status: 'running', error: null } });
    expect(pollSpy).toHaveBeenCalledTimes(2); expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
  it('only an explicitly confirmed provider failure is a terminal failed result', async () => {
    const id = 'video-poll-known-failure'; await start(payload(id));
    const pollSpy = vi.spyOn(FixtureVideoProvider.prototype, 'poll').mockRejectedValueOnce(new ConfirmedVideoFailure());
    expect(await poll(id)).toMatchObject({ ok: true, operation: { status: 'failed', clip: null } });
    expect(await poll(id)).toMatchObject({ ok: true, operation: { status: 'failed', clip: null } });
    expect(pollSpy).toHaveBeenCalledTimes(1);
  });
  it('S6-IT-01 exposes capability preflight and progresses through a reload-safe operation identity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:00.000Z'));
    const preflight = await (await GET(new Request('http://localhost/api/cinema/generate-video'))).json() as VideoPreflightResponse;
    expect(preflight).toMatchObject({ ok: true, mode: 'fixture', usdPerSecond: 0, maximumEstimatedUsd: 0 });
    const id = 'video-route-progress-1';
    const response = await start(payload(id));
    expect(response.status).toBe(202);
    expect(await poll(id)).toMatchObject({ ok: true, operation: { operationId: id, status: 'running' } });
    vi.setSystemTime(new Date('2026-09-02T00:00:00.700Z'));
    expect(await poll(id)).toMatchObject({ ok: true, operation: { status: 'finalizing' } });
    vi.setSystemTime(new Date('2026-09-02T00:00:01.300Z'));
    const completed = await poll(id);
    expect(completed).toMatchObject({ ok: true, operation: { status: 'ready', clip: { mimeType: 'video/mp4', durationSeconds: 1, width: 160, height: 90 } } });
  });

  it('S6-IT-02 preserves terminal cancel, failure, and retry states', async () => {
    const cancelId = 'video-route-cancel-1';
    await start(payload(cancelId));
    const cancelled = await (await DELETE(new Request(ownedUrl(cancelId), { method: 'DELETE', headers: { origin: 'http://localhost' } }))).json() as VideoOperationResponse;
    expect(cancelled).toMatchObject({ ok: true, operation: { status: 'cancelled' } });

    process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR = 'fail';
    const failedId = 'video-route-failed-1';
    await start(payload(failedId));
    expect(await poll(failedId)).toMatchObject({ ok: true, operation: { status: 'failed' } });

    delete process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR;
    const retryId = 'video-route-retry-1';
    expect((await start(payload(retryId))).status).toBe(202);
    expect(await poll(retryId)).toMatchObject({ ok: true, operation: { status: 'running' } });
  });

  it('S6-UT-02 blocks unsupported or unbounded settings before provider work', async () => {
    const invalid = payload('video-route-invalid-1') as unknown as Record<string, unknown>;
    invalid.settings = { aspectRatio: '1:1', durationSeconds: 12, resolution: '4k', audio: true, outputCount: 2, seed: null };
    const response = await start(invalid as unknown as GenerateVideoRequest);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('requires content-bound approval and rejects frame/settings/quote drift before dispatch', async () => {
    const spy = vi.spyOn(FixtureVideoProvider.prototype, 'start');
    const request = payload('video-scope-safety-1');
    expect((await dispatch(request)).status).toBe(400);
    const preflight = await (await GET(new Request('http://localhost/api/cinema/generate-video'))).json() as Extract<VideoPreflightResponse, { ok: true }>;
    request.approval = { quoteId: preflight.quoteId, contentDigest: operationDigest(videoApprovalContent(request, preflight.quoteId)) };
    for (const changed of [
      { ...request, settings: { ...request.settings, durationSeconds: 6 as const } },
      { ...request, startFrame: { ...request.startFrame, id: 'different-frame' } },
      { ...request, sceneId: 'different-scene' },
      { ...request, approval: { ...request.approval, quoteId: 'f'.repeat(64) } },
    ]) expect((await dispatch(changed)).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent starts and rejects reused IDs with different content', async () => {
    const spy = vi.spyOn(FixtureVideoProvider.prototype, 'start');
    const request = payload('video-double-submit-1');
    const results = await Promise.all([start(request), start(request)]);
    expect(results.map((result) => result.status)).toEqual([202, 202]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await start({ ...request, settings: { ...request.settings, durationSeconds: 6 } })).status).toBe(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rejects fake frame signatures, wrong byte sizes, stale prompts and provider-mode mismatch', async () => {
    const spy = vi.spyOn(FixtureVideoProvider.prototype, 'start');
    const request = payload('video-invalid-media-1');
    for (const changed of [
      { ...request, startFrame: { ...request.startFrame, byteSize: 1 } },
      { ...request, startFrame: { ...request.startFrame, base64: 'aGVsbG8=', byteSize: 5 } },
      { ...request, prompt: { ...request.prompt, status: 'stale' } },
      { ...request, liveProviderConsent: true },
    ]) expect((await start(changed)).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fails closed live even with price and common gate configured until separate live verification and enablement', async () => {
    const spy = vi.spyOn(VertexVideoProvider.prototype, 'start');
    vi.stubEnv('CINESERYE_E2E_FIXTURE', 'false'); vi.stubEnv('CINESERYE_PROVIDER_MODE', 'live');
    vi.stubEnv('CINESERYE_LIVE_ENABLED', 'true'); vi.stubEnv('CINESERYE_LIVE_MAX_RUN_COST', '5');
    vi.stubEnv('CINESERYE_GCLOUD_ACTIVE_ACCOUNT', 'elbertluta@gmail.com'); vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'cineserye'); vi.stubEnv('GOOGLE_CLOUD_QUOTA_PROJECT', 'cineserye');
    vi.stubEnv('CINESERYE_VIDEO_USD_PER_SECOND', '0.1'); vi.stubEnv('CINESERYE_VIDEO_MAX_ESTIMATED_USD', '1');
    const preflight = await (await GET(new Request('http://localhost/api/cinema/generate-video'))).json() as Extract<VideoPreflightResponse, { ok: true }>;
    expect(preflight.ready).toBe(false); expect(preflight.blockers.join(' ')).toMatch(/separately approved live verification/);
    expect((await start({ ...payload('video-live-unsafe-1'), liveProviderConsent: true })).status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
    vi.stubEnv('CINESERYE_LIVE_ENABLED', 'false');
    const disabled = await (await GET(new Request('http://localhost/api/cinema/generate-video'))).json() as Extract<VideoPreflightResponse, { ok: true }>;
    expect(disabled.blockers.join(' ')).toMatch(/switch is off/);
  });
  it('rejects missing, wrong-owner and cross-origin access without polling or cancelling the owned take', async () => {
    const id = 'video-owned-scope-1';
    await start(payload(id));
    const spy = vi.spyOn(FixtureVideoProvider.prototype, 'poll');
    expect((await GET(new Request(`http://localhost/api/cinema/generate-video?operationId=${id}`))).status).toBe(400);
    for (const field of ['projectId', 'sceneId', 'shotId', 'revisionId']) {
      const url = new URL(ownedUrl(id)); url.searchParams.set(field, 'other-owner');
      expect((await GET(new Request(url))).status).toBe(400);
      expect((await DELETE(new Request(url, { method: 'DELETE', headers: { origin: 'http://localhost' } }))).status).toBe(400);
    }
    expect((await DELETE(new Request(ownedUrl(id), { method: 'DELETE', headers: { origin: 'https://evil.example' } }))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect(await poll(id)).toMatchObject({ ok: true, operation: { status: 'running' } });
  });
  it('rejects oversized declared upload and cross-origin generation before dispatch', async () => {
    const spy = vi.spyOn(FixtureVideoProvider.prototype, 'start');
    for (const headers of [
      { origin: 'http://localhost', 'content-type': 'application/json', 'content-length': String(50 * 1024 * 1024) },
      { origin: 'https://evil.example', 'content-type': 'application/json' },
    ] as Record<string, string>[]) expect((await POST(new Request('http://localhost/api/cinema/generate-video', { method: 'POST', headers, body: '{}' }))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
