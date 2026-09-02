import { describe, expect, it } from 'vitest';
import type { GenerateStoryboardRequest } from '../../features/storyboard/storyboard-api';
import { VertexStoryboardProvider, validateStoryboardProviderResult } from './storyboard-provider';

const liveIt = process.env.CINESERYE_RUN_STORYBOARD_SMOKE === '1' ? it : it.skip;

describe('opt-in Vertex storyboard smoke', () => {
  liveIt('S4-LIVE-01 returns one bounded safe image without references', async () => {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'global';
    const model = process.env.CINESERYE_VERTEX_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required for the opt-in storyboard smoke.');
    const request: GenerateStoryboardRequest = {
      version: 1,
      idempotencyKey: `storyboard-live-${Date.now()}`,
      shotId: 'safe-shot',
      revisionId: 'safe-revision',
      acceptedPlan: true,
      prompt: {
        id: 'safe-prompt',
        version: 1,
        purpose: 'storyboard',
        status: 'approved',
        text: 'A non-identifiable filmmaker arranging an empty tabletop miniature set, neutral studio lighting, storyboard still, no logos, no text.',
      },
      references: [],
      settings: { aspectRatio: '16:9', outputCount: 1, intent: 'production-safe' },
      explicitConfirmation: true,
      liveProviderConsent: true,
    };
    const result = await new VertexStoryboardProvider(project, location, model)
      .generate(request, new AbortController().signal);
    expect(validateStoryboardProviderResult(result, request).frames).toHaveLength(1);
  }, 120_000);
});
