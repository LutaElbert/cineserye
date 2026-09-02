import type { CinemaVideoOperationStatus, CinemaVideoSettings } from '../../domain/cinema/visual-preproduction';
import type { ProviderErrorCode } from '../scene-planner/plan-scene-api';

export type ApprovedVideoFrameInput = {
  id: string;
  status: 'approved';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  base64: string;
  byteSize: number;
};

export type GenerateVideoRequest = {
  version: 1;
  idempotencyKey: string;
  shotId: string;
  revisionId: string;
  acceptedPlan: true;
  prompt: {
    id: string;
    version: number;
    text: string;
    purpose: 'video';
    negativeConstraints: string[];
    status: string;
  };
  startFrame: ApprovedVideoFrameInput;
  endFrame: ApprovedVideoFrameInput | null;
  referenceIds: string[];
  settings: CinemaVideoSettings;
  explicitConfirmation: true;
  liveProviderConsent: boolean;
};

export type VideoCapabilitySummary = {
  version: string;
  provider: string;
  model: string;
  supportsEndFrame: boolean;
  supportsReferenceImages: false;
  supportsAudio: false;
};

export type VideoOperationSnapshot = {
  operationId: string;
  providerOperationId: string | null;
  status: CinemaVideoOperationStatus;
  provider: string;
  model: string;
  capability: VideoCapabilitySummary;
  estimatedCost: number | null;
  currency: 'USD' | null;
  error: string | null;
  cancellationNote: string | null;
  clip: null | {
    id: string;
    mimeType: 'video/mp4';
    base64: string;
    width: number;
    height: number;
    durationSeconds: number;
    byteSize: number;
  };
};

export type VideoOperationResponse = {
  ok: true;
  version: 1;
  mode: 'fixture' | 'live';
  operation: VideoOperationSnapshot;
} | {
  ok: false;
  error: { code: ProviderErrorCode; message: string; retryable: boolean };
};

export type VideoPreflightResponse = {
  ok: true;
  version: 1;
  mode: 'fixture' | 'live';
  capability: VideoCapabilitySummary & {
    durations: Array<4 | 6 | 8>;
    aspectRatios: Array<'9:16' | '16:9'>;
    resolutions: Array<'720p' | '1080p'>;
    maxOutputs: 1;
  };
  usdPerSecond: number | null;
  maximumEstimatedUsd: number | null;
} | {
  ok: false;
  error: { code: ProviderErrorCode; message: string; retryable: boolean };
};
