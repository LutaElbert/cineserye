import 'server-only';

import { GenerateVideosOperation, GoogleGenAI } from '@google/genai';
import type { GenerateVideoRequest } from '../../features/video/video-api';
import { ProviderError } from './provider-errors';
import type { VideoCapabilityProfile } from './video-capabilities';

export type VideoProviderClip = {
  mimeType: 'video/mp4';
  base64: string;
  width: number;
  height: number;
  durationSeconds: number;
};

/** Only a completed provider operation with an explicit error establishes failure.
 * Transport failures and missing/invalid result bytes do not establish it. */
export class ConfirmedVideoFailure extends ProviderError {
  constructor() { super('PROVIDER_UNAVAILABLE', 'The provider reported that this video operation failed.', false); }
}

export type VideoProviderHandle = {
  name: string;
  startedAt: number;
  operation?: GenerateVideosOperation;
};

export type VideoProviderPoll = {
  handle: VideoProviderHandle;
  status: 'running' | 'finalizing' | 'ready';
  clip: VideoProviderClip | null;
};

export interface VideoGenerationProvider {
  readonly id: string;
  readonly model: string;
  readonly capability: VideoCapabilityProfile;
  start(request: GenerateVideoRequest): Promise<VideoProviderHandle>;
  poll(handle: VideoProviderHandle, request: Pick<GenerateVideoRequest, 'settings'>): Promise<VideoProviderPoll>;
}

// One-second, silent 160×90 H.264 baseline sample, checked in all three browsers.
// Reproduce with ffmpeg: -f lavfi -i color=c=0x312e81:s=160x90:r=24:d=1
// -an -c:v libx264 -profile:v baseline -pix_fmt yuv420p -movflags +faststart sample.mp4
const FIXTURE_MP4_BASE64 = "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";

export function isFixtureVideoSample(base64: string): boolean { return base64 === FIXTURE_MP4_BASE64; }

function dimensions(request: Pick<GenerateVideoRequest, 'settings'>): [number, number] {
  const short = request.settings.resolution === '1080p' ? 1080 : 720;
  const long = request.settings.resolution === '1080p' ? 1920 : 1280;
  return request.settings.aspectRatio === '9:16' ? [short, long] : [long, short];
}

export class FixtureVideoProvider implements VideoGenerationProvider {
  readonly id = 'cineserye-video-fixture';
  readonly model = 'fixture-motion-board-v1';

  constructor(readonly capability: VideoCapabilityProfile, private readonly now = () => Date.now()) {}

  async start(request: GenerateVideoRequest): Promise<VideoProviderHandle> {
    void request;
    return { name: `fixture-video-${crypto.randomUUID()}`, startedAt: this.now() };
  }

  async poll(handle: VideoProviderHandle, request: Pick<GenerateVideoRequest, 'settings'>): Promise<VideoProviderPoll> {
    void request;
    const elapsed = this.now() - handle.startedAt;
    if (elapsed < 600) return { handle, status: 'running', clip: null };
    if (elapsed < 1_200) return { handle, status: 'finalizing', clip: null };
    return {
      handle,
      status: 'ready',
      clip: {
        mimeType: 'video/mp4',
        base64: FIXTURE_MP4_BASE64,
        width: 160,
        height: 90,
        durationSeconds: 1,
      },
    };
  }
}

export class VertexVideoProvider implements VideoGenerationProvider {
  readonly id = 'google-vertex-ai';

  constructor(
    readonly project: string,
    readonly location: string,
    readonly model: string,
    readonly capability: VideoCapabilityProfile,
  ) {}

  private client() {
    return new GoogleGenAI({ vertexai: true, project: this.project, location: this.location, httpOptions: { timeout: 90_000, retryOptions: { attempts: 1 } } });
  }

  async start(request: GenerateVideoRequest): Promise<VideoProviderHandle> {
    const operation = await this.client().models.generateVideos({
      model: this.model,
      source: {
        prompt: request.prompt.text,
        image: { imageBytes: request.startFrame.base64, mimeType: request.startFrame.mimeType },
      },
      config: {
        numberOfVideos: 1,
        durationSeconds: request.settings.durationSeconds,
        aspectRatio: request.settings.aspectRatio,
        resolution: request.settings.resolution,
        generateAudio: false,
        negativePrompt: request.prompt.negativeConstraints.join(', ') || undefined,
        seed: request.settings.seed ?? undefined,
        lastFrame: request.endFrame ? { imageBytes: request.endFrame.base64, mimeType: request.endFrame.mimeType } : undefined,
      },
    });
    if (!operation.name) throw new ProviderError('UNEXPECTED_RESPONSE', 'Vertex AI omitted the video operation identity.');
    return { name: operation.name, startedAt: Date.now(), operation };
  }

  async poll(handle: VideoProviderHandle, request: Pick<GenerateVideoRequest, 'settings'>): Promise<VideoProviderPoll> {
    if (!handle.name) throw new ProviderError('UNEXPECTED_RESPONSE', 'The Vertex video operation cannot be resumed without its saved handle.');
    const restored = Object.assign(new GenerateVideosOperation(), { name: handle.name });
    const operation = await this.client().operations.getVideosOperation({ operation: handle.operation ?? restored });
    const next = { ...handle, operation };
    if (!operation.done) return { handle: next, status: 'running', clip: null };
    if (operation.error) throw new ConfirmedVideoFailure();
    const video = operation.response?.generatedVideos?.[0]?.video;
    if (!video?.videoBytes) {
      throw new ProviderError('UNEXPECTED_RESPONSE', video?.uri
        ? 'Vertex AI returned an external video URI. Configure byte delivery before using it in the local workspace.'
        : 'Vertex AI completed without downloadable video bytes.');
    }
    if (video.mimeType && video.mimeType !== 'video/mp4') throw new ProviderError('UNEXPECTED_RESPONSE', 'Vertex AI returned an unsupported video format.');
    const [width, height] = dimensions(request);
    return {
      handle: next,
      status: 'ready',
      clip: {
        mimeType: 'video/mp4',
        base64: video.videoBytes,
        width,
        height,
        durationSeconds: request.settings.durationSeconds,
      },
    };
  }
}

export function validateVideoProviderClip(clip: VideoProviderClip, capability: VideoCapabilityProfile): void {
  if (clip.mimeType !== 'video/mp4' || clip.base64.length < 32 || clip.base64.length > 128 * 1024 * 1024) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The video provider returned unsupported clip data.');
  }
  const sample = isFixtureVideoSample(clip.base64) && capability.provider === 'cineserye-video-fixture' && clip.durationSeconds === 1 && clip.width === 160 && clip.height === 90;
  if ((!sample && !(capability.durations as readonly number[]).includes(clip.durationSeconds)) || clip.width < 1 || clip.height < 1 || clip.width * clip.height > 3_000_000) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The video provider returned invalid clip metadata.');
  }
}
