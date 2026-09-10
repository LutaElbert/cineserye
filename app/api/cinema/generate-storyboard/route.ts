import 'server-only';

import { z } from 'zod';
import { storyboardApprovalContent, type GenerateStoryboardResponse } from '../../../features/storyboard/storyboard-api';
import { localOperationExecutor, operationDigest } from '../../../server/cinema/operation-repository';
import { storyboardPreflight } from '../../../server/cinema/storyboard-preflight';
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
    status: z.enum(['draft', 'approved']),
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
  approval: z.object({ quoteId: z.string().length(64), contentDigest: z.string().length(64) }).strict().optional(),
}).strict();

export async function GET(): Promise<Response> {
  try { return Response.json(storyboardPreflight()); }
  catch (error) { return Response.json({ ok: false, error: publicProviderError(error) }, { status: 503 }); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > MAX_REQUEST_BYTES) throw new ProviderError('INVALID_REQUEST', 'The storyboard request is too large.');
    let json: unknown;
    try {
      json = JSON.parse(source);
    } catch {
      throw new ProviderError('INVALID_REQUEST', 'The storyboard request is not valid JSON.');
    }
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError('INVALID_REQUEST', 'The storyboard request is malformed or contains an unapproved reference.');
    const payload = parsed.data;
    const preflight = storyboardPreflight();
    const { mode, model, maxOutputs } = preflight;
    if (!preflight.ready) throw new ProviderError('INVALID_CONFIGURATION', preflight.blockers[0]);
    if (mode === 'live' && !payload.liveProviderConsent) {
      throw new ProviderError('INVALID_REQUEST', 'Confirm the live provider content transfer before generating.');
    }
    if (mode === 'live' && (payload.approval?.quoteId !== preflight.quoteId
      || payload.approval.contentDigest !== operationDigest(storyboardApprovalContent(payload, preflight.quoteId)))) {
      throw new ProviderError('INVALID_REQUEST', 'The approved image request or price changed. Review and confirm the current scope again.');
    }
    const provider = mode === 'live'
      ? new VertexStoryboardProvider(
        process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
        process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
        model,
      )
      : new FixtureStoryboardProvider();
    if (!Number.isInteger(maxOutputs) || payload.settings.outputCount > maxOutputs) {
      throw new ProviderError('INVALID_REQUEST', `Storyboard generation is limited to ${maxOutputs} outputs per request.`);
    }
    const estimatedCost = preflight.unitCost * payload.settings.outputCount;
    if (estimatedCost > preflight.maxCost) {
      throw new ProviderError('INVALID_REQUEST', 'The storyboard request exceeds the configured spend limit.');
    }
    const dispatch = async () => validateStoryboardProviderResult(await provider.generate(payload, request.signal), payload);
    const result = mode === 'live'
      ? await (await localOperationExecutor()).execute(`storyboard:${payload.idempotencyKey}`,
        storyboardApprovalContent(payload, preflight.quoteId), dispatch)
      : await dispatch();
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
