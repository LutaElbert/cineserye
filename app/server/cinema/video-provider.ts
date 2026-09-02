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
  poll(handle: VideoProviderHandle, request: GenerateVideoRequest): Promise<VideoProviderPoll>;
}

// A tiny deterministic H.264/MP4 generated once for offline acceptance tests.
const FIXTURE_MP4_BASE64 = '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';

function dimensions(request: GenerateVideoRequest): [number, number] {
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

  async poll(handle: VideoProviderHandle, request: GenerateVideoRequest): Promise<VideoProviderPoll> {
    const elapsed = this.now() - handle.startedAt;
    if (elapsed < 600) return { handle, status: 'running', clip: null };
    if (elapsed < 1_200) return { handle, status: 'finalizing', clip: null };
    const [width, height] = dimensions(request);
    return {
      handle,
      status: 'ready',
      clip: {
        mimeType: 'video/mp4',
        base64: FIXTURE_MP4_BASE64,
        width,
        height,
        durationSeconds: request.settings.durationSeconds,
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
    return new GoogleGenAI({ vertexai: true, project: this.project, location: this.location });
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

  async poll(handle: VideoProviderHandle, request: GenerateVideoRequest): Promise<VideoProviderPoll> {
    if (!handle.operation) throw new ProviderError('UNEXPECTED_RESPONSE', 'The Vertex video operation cannot be resumed.');
    const operation = await this.client().operations.getVideosOperation({ operation: handle.operation });
    const next = { ...handle, operation };
    if (!operation.done) return { handle: next, status: 'running', clip: null };
    if (operation.error) throw new ProviderError('PROVIDER_UNAVAILABLE', 'Vertex AI could not generate the video clip.');
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
  if (!(capability.durations as readonly number[]).includes(clip.durationSeconds) || clip.width < 1 || clip.height < 1 || clip.width * clip.height > 3_000_000) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The video provider returned invalid clip metadata.');
  }
}
