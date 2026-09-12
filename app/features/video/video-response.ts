import { z } from 'zod';
import type { VideoOperationResponse, VideoPreflightResponse } from './video-api';

const text = z.string().trim().min(1).max(500);
const unavailable = z.object({ ok: z.literal(false), error: z.object({ code: z.literal('INVALID_REQUEST'), message: z.string().max(4000), retryable: z.literal(false) }).strict(),
  unavailable: z.object({ operationId: text, reason: z.enum(['expired', 'not-found']) }).strict() }).strict();
export class VideoStatusUnavailable extends Error {
  constructor(readonly reason: 'expired' | 'not-found') {
    super(reason === 'expired' ? 'The retained result expired and cannot be replayed. Any new generation requires a fresh review and approval.' : 'This request is not available in this workspace. Its provider outcome is unknown; do not generate again.');
  }
}
const cost = z.number().finite().nonnegative().nullable();
const capability = z.object({ version: text, provider: text, model: text,
  supportsEndFrame: z.boolean(), supportsReferenceImages: z.literal(false), supportsAudio: z.literal(false) }).strict();
const quote = z.object({ ok: z.literal(true), version: z.literal(1), mode: z.enum(['fixture', 'live']),
  capability: capability.extend({ durations: z.array(z.union([z.literal(4), z.literal(6), z.literal(8)])).min(1).max(3),
    aspectRatios: z.array(z.enum(['9:16', '16:9'])).min(1).max(2), resolutions: z.array(z.enum(['720p', '1080p'])).min(1).max(2), maxOutputs: z.literal(1) }),
  usdPerSecond: cost, maximumEstimatedUsd: cost, ready: z.boolean(),
  blockers: z.array(text).max(40), quoteId: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine(value => value.ready === (value.blockers.length === 0))
  .refine(value => !value.ready || value.mode !== 'live' || value.usdPerSecond !== null && value.maximumEstimatedUsd !== null);
const snapshot = z.object({ ok: z.literal(true), version: z.literal(1), mode: z.enum(['fixture', 'live']),
  operation: z.object({ operationId: text, providerOperationId: text.nullable(),
    status: z.enum(['queued', 'running', 'finalizing', 'ready', 'failed', 'cancelled', 'timed-out', 'unknown']),
    failureConfirmed: z.boolean().optional(),
    provider: text, model: text, capability, estimatedCost: cost, currency: z.literal('USD').nullable(),
    error: z.string().max(4000).nullable(), cancellationNote: z.string().max(4000).nullable(),
    clip: z.object({ id: text, mimeType: z.literal('video/mp4'), base64: z.string().min(4).max(180 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
      width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192),
      durationSeconds: z.number().finite().positive().max(120), byteSize: z.number().int().positive().max(128 * 1024 * 1024),
    }).strict().nullable(),
  }).strict(),
}).strict().refine(value => (value.operation.status === 'ready') === (value.operation.clip !== null))
  .refine(value => !value.operation.failureConfirmed || value.operation.status === 'failed')
  .refine(({ operation }) => operation.provider === operation.capability.provider && operation.model === operation.capability.model);

/** Discovery is not admission. Untrusted endpoint data must satisfy its own
 * contract before displaying a quote or applying an owned operation result. */
export function parseVideoPreflight(value: unknown): Extract<VideoPreflightResponse, { ok: true }> {
  const result = quote.safeParse(value);
  if (!result.success) throw Error('Video request preflight is unavailable or malformed. Refresh workspace status before confirming.');
  return result.data;
}
export function parseVideoOperation(value: unknown, operationId: string): Extract<VideoOperationResponse, { ok: true }> {
  const missing = unavailable.safeParse(value);
  if (missing.success && missing.data.unavailable.operationId === operationId) throw new VideoStatusUnavailable(missing.data.unavailable.reason);
  const result = snapshot.safeParse(value);
  if (!result.success || result.data.operation.operationId !== operationId) throw Error('Video status is unavailable or does not match this request. Check the existing request; do not generate again.');
  return result.data;
}
