import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateVideoRequest, VideoOperationResponse, VideoPreflightResponse } from '../../../features/video/video-api';
import { DELETE, GET, POST } from './route';

function payload(id: string): GenerateVideoRequest {
  return {
    version: 1,
    idempotencyKey: id,
    shotId: 'shot-1',
    revisionId: 'revision-1',
    acceptedPlan: true,
    prompt: { id: 'video-prompt-1', version: 1, text: 'Slow push toward the auditorium screen.', purpose: 'video', negativeConstraints: ['No extra people'], status: 'approved' },
    startFrame: { id: 'frame-1', status: 'approved', mimeType: 'image/png', base64: 'aGVsbG8tdmlkZW8=', byteSize: 11 },
    endFrame: null,
    referenceIds: [],
    settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    explicitConfirmation: true,
    liveProviderConsent: false,
  };
}

async function start(request: GenerateVideoRequest) {
  return POST(new Request('http://localhost/api/cinema/generate-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  }));
}

async function poll(id: string) {
  const response = await GET(new Request(`http://localhost/api/cinema/generate-video?operationId=${id}`));
  return response.json() as Promise<VideoOperationResponse>;
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR;
});

describe('video operation route', () => {
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
    expect(completed).toMatchObject({ ok: true, operation: { status: 'ready', clip: { mimeType: 'video/mp4', durationSeconds: 4 } } });
  });

  it('S6-IT-02 preserves terminal cancel, failure, and retry states', async () => {
    const cancelId = 'video-route-cancel-1';
    await start(payload(cancelId));
    const cancelled = await (await DELETE(new Request(`http://localhost/api/cinema/generate-video?operationId=${cancelId}`, { method: 'DELETE' }))).json() as VideoOperationResponse;
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
});
