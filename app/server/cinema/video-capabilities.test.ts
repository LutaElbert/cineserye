import { describe, expect, it } from 'vitest';
import type { CinemaVideoSettings } from '../../domain/cinema/visual-preproduction';
import {
  FIXTURE_VIDEO_CAPABILITIES,
  createVertexVideoCapabilities,
  estimateVideoSpend,
  validateVideoSettings,
} from './video-capabilities';

const settings: CinemaVideoSettings = {
  aspectRatio: '9:16',
  durationSeconds: 4,
  resolution: '720p',
  audio: false,
  outputCount: 1,
  seed: null,
};

describe('video capability and spend boundary', () => {
  it('accepts only the bounded supported profile', () => {
    expect(() => validateVideoSettings(FIXTURE_VIDEO_CAPABILITIES, settings, { hasStartFrame: true, hasEndFrame: false })).not.toThrow();
    expect(() => validateVideoSettings(FIXTURE_VIDEO_CAPABILITIES, { ...settings, durationSeconds: 5 as 4 }, { hasStartFrame: true, hasEndFrame: false })).toThrow(/duration/i);
    expect(() => validateVideoSettings(FIXTURE_VIDEO_CAPABILITIES, { ...settings, audio: true as false }, { hasStartFrame: true, hasEndFrame: false })).toThrow(/audio/i);
    expect(() => validateVideoSettings({ ...FIXTURE_VIDEO_CAPABILITIES, supportsEndFrame: false }, settings, { hasStartFrame: true, hasEndFrame: true })).toThrow(/end frame/i);
    expect(() => validateVideoSettings(FIXTURE_VIDEO_CAPABILITIES, settings, { hasStartFrame: true, hasEndFrame: false, hasReferenceImages: true })).toThrow(/reference images/i);
    expect(() => validateVideoSettings(FIXTURE_VIDEO_CAPABILITIES, settings, { hasStartFrame: false, hasEndFrame: false })).toThrow(/start frame/i);
    expect(() => validateVideoSettings(createVertexVideoCapabilities('veo-test'), settings, { hasStartFrame: true, hasEndFrame: false, startFrameMimeType: 'image/svg+xml' })).toThrow(/format/i);
  });

  it('uses the current environment-selected Veo profile', () => {
    const profile = createVertexVideoCapabilities('veo-3.1-fast-generate-001');
    expect(profile.model).toBe('veo-3.1-fast-generate-001');
    expect(profile.version).toContain('2026-09-02');
    expect(profile.supportsAudio).toBe(false);
  });

  it('blocks spend over the configured ceiling before generation', () => {
    expect(estimateVideoSpend(settings, 0.1, 1)).toBe(0.4);
    expect(() => estimateVideoSpend({ ...settings, durationSeconds: 8 }, 0.2, 1)).toThrow(/exceeds/i);
    expect(() => estimateVideoSpend(settings, Number.NaN, 1)).toThrow(/pricing/i);
  });
});
