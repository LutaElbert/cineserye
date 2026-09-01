import { describe, expect, it } from 'vitest';
import type { GenerateStoryboardRequest } from '../../features/storyboard/storyboard-api';
import { FixtureStoryboardProvider, validateStoryboardProviderResult } from './storyboard-provider';

const request: GenerateStoryboardRequest = {
  version: 1,
  idempotencyKey: 'storyboard-test-01',
  shotId: 'shot-01',
  revisionId: 'revision-01',
  acceptedPlan: true,
  prompt: { id: 'prompt-01', version: 1, text: 'A restrained close-up in an abandoned cinema.', purpose: 'storyboard', status: 'draft' },
  references: [],
  settings: { aspectRatio: '9:16', outputCount: 3 },
  explicitConfirmation: true,
  liveProviderConsent: false,
};

describe('fixture storyboard provider', () => {
  it('S4-IT-01 produces a deterministic offline three-variant package', async () => {
    const provider = new FixtureStoryboardProvider();
    const first = await provider.generate(request, new AbortController().signal);
    const second = await provider.generate(request, new AbortController().signal);
    expect(first).toEqual(second);
    expect(first.frames).toHaveLength(3);
    expect(first.frames.map((frame) => frame.variantIndex)).toEqual([0, 1, 2]);
    expect(first.frames.every((frame) => frame.mimeType === 'image/svg+xml' && frame.safetyStatus === 'passed')).toBe(true);
  });

  it('S4-IT-02 observes cancellation before provider work begins', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(new FixtureStoryboardProvider().generate(request, controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('S4-UT-02 rejects unsafe or malformed provider output before storage', async () => {
    const result = await new FixtureStoryboardProvider().generate(request, new AbortController().signal);
    result.frames[0].safetyStatus = 'blocked';
    expect(() => validateStoryboardProviderResult(result, request)).toThrow(/blocked.*safety/i);
  });
});
