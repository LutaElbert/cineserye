import 'server-only';

import { z } from 'zod';
import type { GenerateStoryboardResponse } from '../../../features/storyboard/storyboard-api';
import { ProviderError, publicProviderError } from '../../../server/cinema/provider-errors';
import {
  FixtureStoryboardProvider,
  VertexStoryboardProvider,
  validateStoryboardProviderResult,
} from '../../../server/cinema/storyboard-provider';

const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
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
    purpose: z.literal('storyboard'),
    status: z.string().max(40),
  }).strict(),
  references: z.array(z.object({
    id: z.string().min(1).max(160),
    title: z.string().min(1).max(500),
    rightsStatus: z.enum(['creator-owned', 'licensed', 'public-domain']),
    approvalStatus: z.literal('approved'),
    allowedUses: z.array(z.string().max(40)).refine((uses) => uses.includes('image-generation')),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    base64: z.string().min(1).max(20 * 1024 * 1024),
  }).strict()).max(8),
  settings: z.object({
    aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']),
    outputCount: z.number().int().min(1).max(4),
    intent: z.enum(['balanced', 'production-safe', 'emotion-first', 'visually-experimental', 'budget-conscious']),
  }).strict(),
  explicitConfirmation: z.literal(true),
  liveProviderConsent: z.boolean(),
}).strict();

const active = new Map<string, Promise<Awaited<ReturnType<FixtureStoryboardProvider['generate']>>>>();

export async function POST(request: Request): Promise<Response> {
  try {
    const source = await request.text();
    if (source.length > MAX_REQUEST_BYTES) throw new ProviderError('INVALID_REQUEST', 'The storyboard request is too large.');
    let json: unknown;
    try {
      json = JSON.parse(source);
    } catch {
      throw new ProviderError('INVALID_REQUEST', 'The storyboard request is not valid JSON.');
    }
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError('INVALID_REQUEST', 'The storyboard request is malformed or contains an unapproved reference.');
    const payload = parsed.data;
    const mode = process.env.CINESERYE_E2E_FIXTURE === 'true'
      ? 'fixture'
      : process.env.CINESERYE_PROVIDER_MODE === 'live' ? 'live' : 'fixture';
    if (mode === 'live' && !payload.liveProviderConsent) {
      throw new ProviderError('INVALID_REQUEST', 'Confirm the live provider content transfer before generating.');
    }
    const model = process.env.CINESERYE_VERTEX_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
    const provider = mode === 'live'
      ? new VertexStoryboardProvider(
        process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
        process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
        model,
      )
      : new FixtureStoryboardProvider();
    const maxOutputs = Math.min(4, Math.max(1, Number(process.env.CINESERYE_STORYBOARD_MAX_OUTPUTS ?? 4)));
    if (!Number.isInteger(maxOutputs) || payload.settings.outputCount > maxOutputs) {
      throw new ProviderError('INVALID_REQUEST', `Storyboard generation is limited to ${maxOutputs} outputs per request.`);
    }
    const configuredUnitCost = process.env.CINESERYE_STORYBOARD_USD_PER_IMAGE
      ? Number(process.env.CINESERYE_STORYBOARD_USD_PER_IMAGE)
      : mode === 'fixture' ? 0 : null;
    const configuredSpendLimit = process.env.CINESERYE_STORYBOARD_MAX_ESTIMATED_USD
      ? Number(process.env.CINESERYE_STORYBOARD_MAX_ESTIMATED_USD)
      : mode === 'fixture' ? 0 : null;
    if (mode === 'live' && (
      configuredUnitCost === null || !Number.isFinite(configuredUnitCost) || configuredUnitCost < 0
      || configuredSpendLimit === null || !Number.isFinite(configuredSpendLimit) || configuredSpendLimit <= 0
    )) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Live storyboard pricing and a per-request spend limit must be configured before generation.');
    }
    const estimatedCost = configuredUnitCost === null ? null : configuredUnitCost * payload.settings.outputCount;
    if (estimatedCost !== null && configuredSpendLimit !== null && estimatedCost > configuredSpendLimit) {
      throw new ProviderError('INVALID_REQUEST', 'The storyboard request exceeds the configured spend limit.');
    }
    let operation = active.get(payload.idempotencyKey);
    if (!operation) {
      operation = provider.generate(payload, request.signal);
      active.set(payload.idempotencyKey, operation);
      void operation.then(
        () => active.delete(payload.idempotencyKey),
        () => active.delete(payload.idempotencyKey),
      );
    }
    const result = validateStoryboardProviderResult(await operation, payload);
    const response: GenerateStoryboardResponse = {
      ok: true,
      version: 1,
      mode,
      runId: payload.idempotencyKey,
      provider: result.provider,
      model: result.model,
      estimatedCost,
      currency: estimatedCost === null ? null : 'USD',
      frames: result.frames,
    };
    return Response.json(response);
  } catch (error) {
    const safe = publicProviderError(error);
    const response: GenerateStoryboardResponse = { ok: false, error: safe };
    const status = safe.code === 'INVALID_REQUEST' ? 400 : safe.code === 'CANCELLED' ? 499 : 503;
    return Response.json(response, { status });
  }
}
