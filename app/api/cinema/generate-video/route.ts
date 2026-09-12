import 'server-only';

import { z } from 'zod';
import { videoApprovalContent } from '../../../features/video/video-api';
import { operationDigest } from '../../../server/cinema/operation-repository';
import { videoPolicy } from '../../../server/cinema/video-policy';
import { detectImageType } from '../../../editor/image-file';
import { assertLocalRequest } from '../../../server/cinema/local-request';
import { inspectVideoBytes, videoDecoderAvailable } from '../../../server/cinema/video-media';
import { localVideoOperationStore, VideoResultUnavailable, type SavedVideoOperation, type VideoOwner } from '../../../server/cinema/video-operation-store';
import type {
  GenerateVideoRequest,
  VideoOperationResponse,
  VideoPreflightResponse,
} from '../../../features/video/video-api';
import {
  estimateVideoSpend,
  validateVideoSettings,
  type VideoCapabilityProfile,
} from '../../../server/cinema/video-capabilities';
import { ProviderError, publicProviderError } from '../../../server/cinema/provider-errors';
import {
  FixtureVideoProvider,
  ConfirmedVideoFailure,
  VertexVideoProvider,
  validateVideoProviderClip,
  type VideoGenerationProvider,
} from '../../../server/cinema/video-provider';

const MAX_REQUEST_BYTES = 42 * 1024 * 1024;
const MAX_OPERATION_AGE_MS = 15 * 60 * 1000;

async function boundedJsonBody(request: Request): Promise<string> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) throw new ProviderError('INVALID_REQUEST', 'The video request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ProviderError('INVALID_REQUEST', 'The video request body is missing.');
  const chunks: Uint8Array[] = []; let bytes = 0, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 30_000);
  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) throw new ProviderError('INVALID_REQUEST', 'The local video upload timed out. No provider was started.');
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ProviderError('INVALID_REQUEST', 'The video request is too large.'); }
      chunks.push(chunk.value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

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
  projectId: z.string().min(1).max(160),
  sceneId: z.string().min(1).max(160),
  approval: z.object({ quoteId: z.string().regex(/^[a-f0-9]{64}$/), contentDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
}).strict();

const OwnerSchema = z.object({ operationId: z.string().regex(/^[a-zA-Z0-9_-]{8,160}$/), projectId: z.string().min(1).max(160), sceneId: z.string().min(1).max(160), shotId: z.string().min(1).max(160), revisionId: z.string().min(1).max(160) }).strict();
function requestOwner(url: URL, allowReconcile = false): VideoOwner {
  const parameters = Object.fromEntries(url.searchParams);
  if (allowReconcile && parameters.reconcile === '1') delete parameters.reconcile;
  const parsed = OwnerSchema.safeParse(parameters);
  if (!parsed.success) throw new ProviderError('INVALID_REQUEST', 'Video polling and cancellation require the exact project, scene, shot, revision and operation IDs.');
  return parsed.data;
}

function configuration(): {
  mode: 'fixture' | 'live';
  profile: VideoCapabilityProfile;
  provider: VideoGenerationProvider;
  unitCost: number | null;
  spendLimit: number | null;
  blockers: string[];
} {
  const policy = videoPolicy();
  const { mode, profile } = policy;
  return {
    ...policy,
    provider: mode === 'fixture' ? new FixtureVideoProvider(profile) : new VertexVideoProvider(
      process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
      process.env.CINESERYE_VERTEX_VIDEO_LOCATION?.trim() || 'us-central1',
      profile.model,
      profile,
    ),
  };
}

function quoteId(config: ReturnType<typeof configuration>) {
  return operationDigest({ version: 1, mode: config.mode, capability: config.profile, unitCost: config.unitCost, spendLimit: config.spendLimit, blockers: config.blockers });
}

function operationResponse(operationId: string, stored: SavedVideoOperation, cancellationNote: string | null = null): VideoOperationResponse {
  return {
    ok: true,
    version: 1,
    mode: stored.mode,
    operation: {
      operationId,
      providerOperationId: stored.handle.name || null,
      status: stored.status,
      failureConfirmed: stored.status === 'failed' && stored.outcomeVersion === 1,
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
  if (error instanceof VideoResultUnavailable) return Response.json({ ok: false,
    error: { code: error.code, message: error.message, retryable: false },
    unavailable: { operationId: error.operationId, reason: error.reason } }, { status: error.reason === 'expired' ? 410 : 400, headers: { 'cache-control': 'no-store' } });
  const safe = publicProviderError(error);
  const response: VideoOperationResponse = { ok: false, error: safe };
  const status = safe.code === 'INVALID_REQUEST' ? 400 : safe.code === 'CANCELLED' ? 499 : 503;
  return Response.json(response, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertLocalRequest(request, { mutation: true, json: true });
    const source = await boundedJsonBody(request);
    let json: unknown;
    try { json = JSON.parse(source); } catch { throw new ProviderError('INVALID_REQUEST', 'The video request is not valid JSON.'); }
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError('INVALID_REQUEST', 'The video request is malformed or lacks an approved frame.');
    const payload = parsed.data as GenerateVideoRequest;
    const config = configuration();
    if (config.mode === 'live' && !config.blockers.length && !await videoDecoderAvailable()) config.blockers.push('Native ffprobe is required to verify actual provider clip metadata.');
    if (config.blockers.length) throw new ProviderError('INVALID_CONFIGURATION', config.blockers.join(' '));
    const expectedQuoteId = quoteId(config);
    if (payload.approval?.quoteId !== expectedQuoteId || payload.approval.contentDigest !== operationDigest(videoApprovalContent(payload, expectedQuoteId))) {
      throw new ProviderError('INVALID_REQUEST', 'The video content or estimate changed. Review this exact frame, prompt, settings and cost again.');
    }
    if (config.mode === 'live' && !payload.liveProviderConsent) throw new ProviderError('INVALID_REQUEST', 'Confirm the live provider content transfer before generating.');
    if (config.mode === 'fixture' && payload.liveProviderConsent) throw new ProviderError('INVALID_REQUEST', 'Provider mode changed. Review the fixture scope before continuing.');
    if (payload.prompt.status === 'stale') throw new ProviderError('INVALID_REQUEST', 'Refresh the stale motion prompt before generating.');
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
    for (const frame of [payload.startFrame, payload.endFrame].filter((value): value is NonNullable<typeof value> => Boolean(value))) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(frame.base64)) throw new ProviderError('INVALID_REQUEST', 'A frame has invalid base64 encoding.');
      const bytes = Buffer.from(frame.base64, 'base64');
      const mimeMatches = frame.mimeType === 'image/svg+xml' ? config.mode === 'fixture' && /^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.toString('utf8').trim())
        : detectImageType(bytes) === frame.mimeType;
      if (bytes.length !== frame.byteSize || bytes.length > config.profile.maxInputBytes || !mimeMatches) throw new ProviderError('INVALID_REQUEST', 'A frame does not match its approved bytes, size or image type.');
    }
    if (config.mode === 'live' && (config.unitCost === null || config.spendLimit === null)) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Live video pricing and a per-request spend limit must be configured before generation.');
    }
    const estimatedCost = config.unitCost === null || config.spendLimit === null
      ? null
      : estimateVideoSpend(payload.settings, config.unitCost, config.spendLimit);
    const digest = operationDigest(videoApprovalContent(payload, expectedQuoteId));
    const store = await localVideoOperationStore();
    const saved = await store.start({ version: 1, digest,
      owner: { projectId: payload.projectId!, sceneId: payload.sceneId!, shotId: payload.shotId, revisionId: payload.revisionId, operationId: payload.idempotencyKey },
      mode: config.mode, provider: { id: config.provider.id, model: config.provider.model,
        project: config.provider instanceof VertexVideoProvider ? config.provider.project : null,
        location: config.provider instanceof VertexVideoProvider ? config.provider.location : null },
      settings: payload.settings, capability: config.profile,
      handle: { name: '', startedAt: Date.now() }, status: 'queued', estimatedCost,
      currency: estimatedCost === null ? null : 'USD', error: null, clip: null,
    }, () => config.provider.start(payload));
    return Response.json(operationResponse(payload.idempotencyKey, saved), { status: 202, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return safeError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = assertLocalRequest(request);
    const operationId = url.searchParams.get('operationId');
    if (!operationId) {
      const config = configuration();
      if (config.mode === 'live' && !config.blockers.length && !await videoDecoderAvailable()) config.blockers.push('Native ffprobe is required to verify actual provider clip metadata.');
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
        ready: config.blockers.length === 0,
        blockers: config.blockers,
        quoteId: quoteId(config),
      };
      return Response.json(response, { headers: { 'cache-control': 'no-store' } });
    }
    const owner = requestOwner(url, true), store = await localVideoOperationStore();
    const saved = await store.poll(owner, async (stored) => {
    const reconcile = url.searchParams.get('reconcile') === '1' && stored.status === 'unknown';
    if (stored.status === 'unknown' && !reconcile) return stored;
    if (!reconcile && Date.now() > (stored.trackingDeadline ?? stored.handle.startedAt + MAX_OPERATION_AGE_MS) || (stored.mode === 'fixture' && process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR === 'timeout')) {
      return { ...stored, status: stored.mode === 'live' ? 'unknown' : 'timed-out', error: 'Local tracking timed out. Provider processing and billing may continue.' };
    }
    if (stored.mode === 'fixture' && process.env.CINESERYE_VIDEO_FIXTURE_BEHAVIOR === 'fail') {
      return { ...stored, status: 'failed', error: 'The fixture video operation failed as requested.' };
    }
    try {
      const provider = stored.mode === 'fixture' ? new FixtureVideoProvider(stored.capability)
        : new VertexVideoProvider(stored.provider.project!, stored.provider.location!, stored.provider.model, stored.capability);
      const polled = await provider.poll(stored.handle, { settings: stored.settings });
      const next: SavedVideoOperation = { ...stored, handle: { name: polled.handle.name, startedAt: stored.handle.startedAt }, status: polled.status, error: null,
        ...(reconcile ? { trackingDeadline: Date.now() + MAX_OPERATION_AGE_MS } : {}) };
      if (polled.status === 'ready' && polled.clip) {
        validateVideoProviderClip(polled.clip, stored.capability);
        next.clip = {
          id: `${operationId}-clip-1`,
          ...await inspectVideoBytes(polled.clip, stored.settings, stored.mode),
        };
      }
      if (next.status === 'ready' && !next.clip) throw new ProviderError('UNEXPECTED_RESPONSE', 'The provider completed without verified clip bytes.');
      return next;
    } catch (error) {
      return { ...stored, status: error instanceof ConfirmedVideoFailure ? 'failed' : 'unknown',
        error: error instanceof ConfirmedVideoFailure ? error.message : 'The video outcome is unknown. Check this existing request; provider processing and billing may continue.' };
    }
    });
    return Response.json(operationResponse(operationId, saved), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const owner = requestOwner(assertLocalRequest(request, { mutation: true }));
    const stored = (await localVideoOperationStore()).cancel(owner);
    const note = stored.mode === 'live'
      ? 'Local polling stopped. The current Google GenAI SDK does not expose service-side Veo cancellation, so provider processing and billing may continue.'
      : 'The offline fixture operation was cancelled locally and incurred no cost.';
    return Response.json(operationResponse(owner.operationId, stored, note), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return safeError(error);
  }
}
