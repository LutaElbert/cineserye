import 'server-only';

import { z } from 'zod';
import type {
  GenerateVideoRequest,
  VideoOperationResponse,
  VideoOperationSnapshot,
  VideoPreflightResponse,
} from '../../../features/video/video-api';
import {
  FIXTURE_VIDEO_CAPABILITIES,
  createVertexVideoCapabilities,
  estimateVideoSpend,
  validateVideoSettings,
  type VideoCapabilityProfile,
} from '../../../server/cinema/video-capabilities';
import { ProviderError, publicProviderError } from '../../../server/cinema/provider-errors';
import {
  FixtureVideoProvider,
  VertexVideoProvider,
  validateVideoProviderClip,
  type VideoGenerationProvider,
  type VideoProviderHandle,
} from '../../../server/cinema/video-provider';

const MAX_REQUEST_BYTES = 42 * 1024 * 1024;
const MAX_OPERATION_AGE_MS = 15 * 60 * 1000;

const FrameSchema = z.object({
  id: z.string().min(1).max(160),
  status: z.literal('approved'),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  base64: z.string().min(8).max(20 * 1024 * 1024),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024),
}).strict();

const RequestSchema = z.object({
  version: z.literal(1),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,160}$/),
  shotId: z.string().min(1).max(160),
  revisionId: z.string().min(1).max(160),
  acceptedPlan: z.literal(true),
  prompt: z.object({
    id: z.string().min(1).max(160),
    version: z.number().int().positive(),
    text: z.string().min(1).max(20_000),
    purpose: z.literal('video'),
    negativeConstraints: z.array(z.string().min(1).max(1_000)).max(50),
    status: z.string().max(40),
  }).strict(),
  startFrame: FrameSchema,
  endFrame: FrameSchema.nullable(),
  referenceIds: z.array(z.string().min(1).max(160)).max(8),
  settings: z.object({
    aspectRatio: z.enum(['9:16', '16:9']),
    durationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    resolution: z.enum(['720p', '1080p']),
    audio: z.literal(false),
    outputCount: z.literal(1),
    seed: z.number().int().nonnegative().nullable(),
  }).strict(),
  explicitConfirmation: z.literal(true),
  liveProviderConsent: z.boolean(),
}).strict();

type StoredOperation = {
  request: GenerateVideoRequest;
  mode: 'fixture' | 'live';
  provider: VideoGenerationProvider;
  capability: VideoCapabilityProfile;
  handle: VideoProviderHandle;
  status: 'queued' | 'running' | 'finalizing' | 'ready' | 'failed' | 'cancelled' | 'timed-out';
  estimatedCost: number | null;
  currency: 'USD' | null;
  error: string | null;
  clip: VideoOperationSnapshot['clip'];
};

const operations = new Map<string, StoredOperation>();

function configuration(): {
  mode: 'fixture' | 'live';
  profile: VideoCapabilityProfile;
  provider: VideoGenerationProvider;
  unitCost: number | null;
  spendLimit: number | null;
} {
  const mode = process.env.CINESERYE_E2E_FIXTURE === 'true'
    ? 'fixture'
    : process.env.CINESERYE_PROVIDER_MODE === 'live' ? 'live' : 'fixture';
  if (mode === 'fixture') {
    return {
      mode,
      profile: FIXTURE_VIDEO_CAPABILITIES,
      provider: new FixtureVideoProvider(FIXTURE_VIDEO_CAPABILITIES),
      unitCost: 0,
      spendLimit: 0,
    };
  }
  const model = process.env.CINESERYE_VERTEX_VIDEO_MODEL?.trim() || 'veo-3.1-fast-generate-001';
  const profile = createVertexVideoCapabilities(model);
  const unitCost = process.env.CINESERYE_VIDEO_USD_PER_SECOND ? Number(process.env.CINESERYE_VIDEO_USD_PER_SECOND) : null;
  const spendLimit = process.env.CINESERYE_VIDEO_MAX_ESTIMATED_USD ? Number(process.env.CINESERYE_VIDEO_MAX_ESTIMATED_USD) : null;
  return {
    mode,
    profile,
    provider: new VertexVideoProvider(
      process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
      process.env.CINESERYE_VERTEX_VIDEO_LOCATION?.trim() || 'us-central1',
      model,
      profile,
    ),
    unitCost,
    spendLimit,
  };
}

function operationResponse(operationId: string, stored: StoredOperation, cancellationNote: string | null = null): VideoOperationResponse {
  return {
    ok: true,
    version: 1,
    mode: stored.mode,
    operation: {
      operationId,
      providerOperationId: stored.handle.name || null,
      status: stored.status,
      provider: stored.provider.id,
      model: stored.provider.model,
      capability: {
        version: stored.capability.version,
        provider: stored.capability.provider,
        model: stored.capability.model,
        supportsEndFrame: stored.capability.supportsEndFrame,
        supportsReferenceImages: false,
        supportsAudio: false,
      },
      estimatedCost: stored.estimatedCost,
      currency: stored.currency,
      error: stored.error,
      cancellationNote,
      clip: stored.clip,
    },
  };
}

function safeError(error: unknown): Response {
  const safe = publicProviderError(error);
  const response: VideoOperationResponse = { ok: false, error: safe };
  const status = safe.code === 'INVALID_REQUEST' ? 400 : safe.code === 'CANCELLED' ? 499 : 503;
  return Response.json(response, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const source = await request.text();
    if (source.length > MAX_REQUEST_BYTES) throw new ProviderError('INVALID_REQUEST', 'The video request is too large.');
    let json: unknown;
    try { json = JSON.parse(source); } catch { throw new ProviderError('INVALID_REQUEST', 'The video request is not valid JSON.'); }
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError('INVALID_REQUEST', 'The video request is malformed or lacks an approved frame.');
    const payload = parsed.data as GenerateVideoRequest;
    const config = configuration();
    if (config.mode === 'live' && !payload.liveProviderConsent) throw new ProviderError('INVALID_REQUEST', 'Confirm the live provider content transfer before generating.');
    if (payload.referenceIds.length) throw new ProviderError('INVALID_REQUEST', 'This start-frame workflow does not send separate reference images to the selected model.');
    validateVideoSettings(config.profile, payload.settings, {
      hasStartFrame: true,
      hasEndFrame: payload.endFrame !== null,
      hasReferenceImages: payload.referenceIds.length > 0,
      startFrameMimeType: payload.startFrame.mimeType,
      endFrameMimeType: payload.endFrame?.mimeType,
    });
    if (payload.startFrame.byteSize > config.profile.maxInputBytes || (payload.endFrame?.byteSize ?? 0) > config.profile.maxInputBytes) {
      throw new ProviderError('INVALID_REQUEST', 'A video frame exceeds the provider input limit.');
    }
    if (config.mode === 'live' && (config.unitCost === null || config.spendLimit === null)) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Live video pricing and a per-request spend limit must be configured before generation.');
    }
    const estimatedCost = config.unitCost === null || config.spendLimit === null
      ? null
      : estimateVideoSpend(payload.settings, config.unitCost, config.spendLimit);
    const existing = operations.get(payload.idempotencyKey);
    if (existing) return Response.json(operationResponse(payload.idempotencyKey, existing));
    const handle = await config.provider.start(payload);
    const stored: StoredOperation = {
      request: payload,
      mode: config.mode,
      provider: config.provider,
      capability: config.profile,
      handle,
      status: 'queued',
      estimatedCost,
      currency: estimatedCost === null ? null : 'USD',
      error: null,
      clip: null,
    };
    operations.set(payload.idempotencyKey, stored);
    return Response.json(operationResponse(payload.idempotencyKey, stored), { status: 202 });
  } catch (error) {
    return safeError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const operationId = new URL(request.url).searchParams.get('operationId');
    if (!operationId) {
      const config = configuration();
      const response: VideoPreflightResponse = {
        ok: true,
        version: 1,
        mode: config.mode,
        capability: {
          version: config.profile.version,
          provider: config.profile.provider,
          model: config.profile.model,
          supportsEndFrame: config.profile.supportsEndFrame,
          supportsReferenceImages: false,
          supportsAudio: false,
          durations: [...config.profile.durations],
          aspectRatios: [...config.profile.aspectRatios],
          resolutions: [...config.profile.resolutions],
          maxOutputs: 1,
        },
        usdPerSecond: config.unitCost,
        maximumEstimatedUsd: config.spendLimit,
      };
      return Response.json(response);
    }
    const stored = operations.get(operationId);
    if (!stored) throw new ProviderError('INVALID_REQUEST', 'That video operation is not available on this local server.');
    if (['ready', 'failed', 'cancelled', 'timed-out'].includes(stored.status)) return Response.json(operationResponse(operationId, stored));
    if (Date.now() - stored.handle.startedAt > MAX_OPERATION_AGE_MS || process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR === 'timeout') {
      stored.status = 'timed-out';
      stored.error = 'The video operation exceeded the local tracking timeout.';
      return Response.json(operationResponse(operationId, stored));
    }
    if (process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR === 'fail') {
      stored.status = 'failed';
      stored.error = 'The fixture video operation failed as requested.';
      return Response.json(operationResponse(operationId, stored));
    }
    try {
      const polled = await stored.provider.poll(stored.handle, stored.request);
      stored.handle = polled.handle;
      stored.status = polled.status;
      if (polled.status === 'ready' && polled.clip) {
        validateVideoProviderClip(polled.clip, stored.capability);
        stored.clip = {
          id: `${operationId}-clip-1`,
          ...polled.clip,
          byteSize: Math.floor(polled.clip.base64.length * 3 / 4),
        };
      }
    } catch (error) {
      stored.status = 'failed';
      stored.error = publicProviderError(error).message;
    }
    return Response.json(operationResponse(operationId, stored));
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const operationId = new URL(request.url).searchParams.get('operationId');
    if (!operationId) throw new ProviderError('INVALID_REQUEST', 'A video operation id is required.');
    const stored = operations.get(operationId);
    if (!stored) throw new ProviderError('INVALID_REQUEST', 'That video operation is not available on this local server.');
    if (!['ready', 'failed', 'cancelled', 'timed-out'].includes(stored.status)) stored.status = 'cancelled';
    stored.error = stored.status === 'cancelled' ? 'Cancelled by creator.' : stored.error;
    const note = stored.mode === 'live'
      ? 'Local polling stopped. The current Google GenAI SDK does not expose service-side Veo cancellation, so provider processing and billing may continue.'
      : 'The offline fixture operation was cancelled locally and incurred no cost.';
    return Response.json(operationResponse(operationId, stored, note));
  } catch (error) {
    return safeError(error);
  }
}
