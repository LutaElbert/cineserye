import { describe, expect, it } from 'vitest';
import type { GenerateVideoRequest } from '../../features/video/video-api';
import { createVertexVideoCapabilities } from './video-capabilities';
import { publicProviderError } from './provider-errors';
import { VertexVideoProvider, validateVideoProviderClip } from './video-provider';

const liveIt = process.env.CINESERYE_RUN_VIDEO_SMOKE === '1' ? it : it.skip;

describe('opt-in Vertex Veo video smoke', () => {
  liveIt('S6-LIVE-01 completes one bounded sample or returns a classified provider error', async () => {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.CINESERYE_VERTEX_VIDEO_LOCATION ?? 'us-central1';
    const model = process.env.CINESERYE_VERTEX_VIDEO_MODEL ?? 'veo-3.1-fast-generate-001';
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required for the opt-in video smoke.');
    const capability = createVertexVideoCapabilities(model);
    const provider = new VertexVideoProvider(project, location, model, capability);
    const request: GenerateVideoRequest = {
      version: 1,
      idempotencyKey: `video-live-${Date.now()}`,
      shotId: 'safe-shot',
      revisionId: 'safe-revision',
      acceptedPlan: true,
      prompt: {
        id: 'safe-video-prompt',
        version: 1,
        purpose: 'video',
        status: 'approved',
        text: 'A slow camera push toward an empty abstract tabletop set under neutral studio light. No people, text, or logos.',
        negativeConstraints: ['No people', 'No text', 'No logos'],
      },
      startFrame: {
        id: 'safe-frame',
        status: 'approved',
        mimeType: 'image/png',
        // One opaque neutral pixel keeps this opt-in smoke non-confidential.
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        byteSize: 68,
      },
      endFrame: null,
      referenceIds: [],
      settings: { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
      explicitConfirmation: true,
      liveProviderConsent: true,
    };
    try {
      let handle = await provider.start(request);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const result = await provider.poll(handle, request);
        handle = result.handle;
        if (result.status === 'ready' && result.clip) {
          const clip = result.clip;
          expect(() => validateVideoProviderClip(clip, capability)).not.toThrow();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
      throw new Error('The bounded video smoke exceeded its five-minute polling limit.');
    } catch (error) {
      const classified = publicProviderError(error);
      expect(['INVALID_REQUEST', 'INVALID_CONFIGURATION', 'PROVIDER_UNAVAILABLE', 'UNEXPECTED_RESPONSE', 'RATE_LIMITED', 'TIMEOUT']).toContain(classified.code);
    }
  }, 330_000);
});
