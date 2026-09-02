import type { CinemaVideoSettings } from '../../domain/cinema/visual-preproduction';
import { ProviderError } from './provider-errors';

export type VideoCapabilityProfile = {
  version: string;
  provider: string;
  model: string;
  durations: readonly CinemaVideoSettings['durationSeconds'][];
  aspectRatios: readonly CinemaVideoSettings['aspectRatio'][];
  resolutions: readonly CinemaVideoSettings['resolution'][];
  supportsStartFrame: true;
  supportsEndFrame: boolean;
  supportsReferenceImages: false;
  supportsAudio: false;
  maxOutputs: 1;
  maxInputBytes: number;
  frameMimeTypes: ReadonlyArray<'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml'>;
};

export const FIXTURE_VIDEO_CAPABILITIES: VideoCapabilityProfile = {
  version: 'fixture-video-v1',
  provider: 'cineserye-video-fixture',
  model: 'fixture-motion-board-v1',
  durations: [4, 6, 8],
  aspectRatios: ['9:16', '16:9'],
  resolutions: ['720p', '1080p'],
  supportsStartFrame: true,
  supportsEndFrame: true,
  supportsReferenceImages: false,
  supportsAudio: false,
  maxOutputs: 1,
  maxInputBytes: 20 * 1024 * 1024,
  frameMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
};

export function createVertexVideoCapabilities(model: string): VideoCapabilityProfile {
  return {
    version: 'vertex-veo-3.1-2026-09-02',
    provider: 'google-vertex-ai',
    model,
    durations: [4, 6, 8],
    aspectRatios: ['9:16', '16:9'],
    resolutions: ['720p', '1080p'],
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsReferenceImages: false,
    supportsAudio: false,
    maxOutputs: 1,
    maxInputBytes: 20 * 1024 * 1024,
    frameMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  };
}

export function validateVideoSettings(
  profile: VideoCapabilityProfile,
  settings: CinemaVideoSettings,
  options: {
    hasStartFrame: boolean;
    hasEndFrame: boolean;
    hasReferenceImages?: boolean;
    startFrameMimeType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
    endFrameMimeType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  },
): void {
  if (!options.hasStartFrame) throw new ProviderError('INVALID_REQUEST', 'An approved start frame is required.');
  if (options.hasEndFrame && !profile.supportsEndFrame) throw new ProviderError('INVALID_REQUEST', 'The selected model does not support an end frame.');
  if (options.hasReferenceImages && !profile.supportsReferenceImages) throw new ProviderError('INVALID_REQUEST', 'The selected model does not support reference images together with a start frame.');
  if (options.startFrameMimeType && !profile.frameMimeTypes.includes(options.startFrameMimeType)) throw new ProviderError('INVALID_REQUEST', 'The approved start-frame format is not supported by the selected model.');
  if (options.endFrameMimeType && !profile.frameMimeTypes.includes(options.endFrameMimeType)) throw new ProviderError('INVALID_REQUEST', 'The approved end-frame format is not supported by the selected model.');
  if (!profile.durations.includes(settings.durationSeconds)) throw new ProviderError('INVALID_REQUEST', 'The selected duration is not supported.');
  if (!profile.aspectRatios.includes(settings.aspectRatio)) throw new ProviderError('INVALID_REQUEST', 'The selected aspect ratio is not supported.');
  if (!profile.resolutions.includes(settings.resolution)) throw new ProviderError('INVALID_REQUEST', 'The selected resolution is not supported.');
  if (settings.audio !== false || profile.supportsAudio !== false) throw new ProviderError('INVALID_REQUEST', 'Audio generation is not available in this capability profile.');
  if (settings.outputCount !== 1 || settings.outputCount > profile.maxOutputs) throw new ProviderError('INVALID_REQUEST', 'This experiment is limited to one clip.');
}

export function estimateVideoSpend(
  settings: CinemaVideoSettings,
  unitUsdPerSecond: number,
  maximumUsd: number,
): number {
  if (!Number.isFinite(unitUsdPerSecond) || unitUsdPerSecond < 0) throw new ProviderError('INVALID_CONFIGURATION', 'Video unit pricing is invalid.');
  if (!Number.isFinite(maximumUsd) || maximumUsd < 0) throw new ProviderError('INVALID_CONFIGURATION', 'The video spend limit is invalid.');
  const estimate = Math.round(settings.durationSeconds * settings.outputCount * unitUsdPerSecond * 100) / 100;
  if (estimate > maximumUsd) throw new ProviderError('INVALID_REQUEST', `The estimated video cost of $${estimate.toFixed(2)} exceeds the configured $${maximumUsd.toFixed(2)} limit.`);
  return estimate;
}
