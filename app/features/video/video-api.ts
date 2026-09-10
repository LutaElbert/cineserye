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
  /** Required by the application route; optional for direct provider fixtures. */
  projectId?: string;
  sceneId?: string;
  approval?: { quoteId: string; contentDigest: string };
};

export function videoApprovalContent(request: GenerateVideoRequest, quoteId: string) {
  return { version: 1, quoteId, projectId: request.projectId, sceneId: request.sceneId,
    shotId: request.shotId, revisionId: request.revisionId, acceptedPlan: request.acceptedPlan,
    prompt: request.prompt, startFrame: request.startFrame, endFrame: request.endFrame,
    referenceIds: request.referenceIds, settings: request.settings, liveProviderConsent: request.liveProviderConsent };
}

export function ownedVideoOperationUrl(scope: { projectId: string; sceneId: string; shotId: string; revisionId: string; operationId: string }) {
  return `/api/cinema/generate-video?${new URLSearchParams(scope).toString()}`;
}

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
  ready: boolean;
  blockers: string[];
  quoteId: string;
} | {
  ok: false;
  error: { code: ProviderErrorCode; message: string; retryable: boolean };
};
