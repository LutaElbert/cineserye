import { describe, expect, it } from 'vitest';
import type { GenerateVideoRequest } from '../../features/video/video-api';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';
import { FixtureVideoProvider, validateVideoProviderClip } from './video-provider';

const request: GenerateVideoRequest = {
  version: 1,
  idempotencyKey: 'video-test-1234',
  shotId: 'shot-1',
  revisionId: 'revision-1',
  acceptedPlan: true,
  prompt: { id: 'prompt-1', version: 1, text: 'A slow deliberate push forward.', purpose: 'video', negativeConstraints: [], status: 'approved' },
  startFrame: { id: 'frame-1', status: 'approved', mimeType: 'image/png', base64: 'aGVsbG8=', byteSize: 5 },
  endFrame: null,
  referenceIds: [],
  settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
  explicitConfirmation: true,
  liveProviderConsent: false,
};

describe('fixture video provider', () => {
  it('progresses deterministically from running through finalizing to ready', async () => {
    let now = 1_000;
    const provider = new FixtureVideoProvider(FIXTURE_VIDEO_CAPABILITIES, () => now);
    const handle = await provider.start(request);
    expect((await provider.poll(handle, request)).status).toBe('running');
    now = 1_700;
    expect((await provider.poll(handle, request)).status).toBe('finalizing');
    now = 2_300;
    const result = await provider.poll(handle, request);
    expect(result.status).toBe('ready');
    expect(result.clip?.mimeType).toBe('video/mp4');
    expect(() => validateVideoProviderClip(result.clip!, FIXTURE_VIDEO_CAPABILITIES)).not.toThrow();
  });

  it('rejects malformed output metadata', () => {
    expect(() => validateVideoProviderClip({ mimeType: 'video/mp4', base64: 'tiny', width: 1, height: 1, durationSeconds: 4 }, FIXTURE_VIDEO_CAPABILITIES)).toThrow(/unsupported/i);
  });
});
