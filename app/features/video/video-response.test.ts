import { expect, it } from 'vitest';
import { parseVideoPreflight, parseVideoOperation, VideoStatusUnavailable } from './video-response';
import { parseStoryboardPreflight } from '../storyboard/storyboard-response';
const capability = { version: '1', provider: 'fixture', model: 'fixture', supportsEndFrame: true, supportsReferenceImages: false, supportsAudio: false };
const quote = { ok: true, version: 1, mode: 'fixture', capability: { ...capability, durations: [4, 6, 8], aspectRatios: ['9:16', '16:9'], resolutions: ['720p', '1080p'], maxOutputs: 1 }, usdPerSecond: 0, maximumEstimatedUsd: 0, ready: true, blockers: [], quoteId: 'a'.repeat(64) };
it('classifies only an exact owned structured tombstone, never an error message alone', () => {
  const response = { ok: false, error: { code: 'INVALID_REQUEST', message: 'expired', retryable: false }, unavailable: { operationId: 'operation-1', reason: 'expired' } };
  expect(() => parseVideoOperation(response, 'operation-1')).toThrow(VideoStatusUnavailable);
  for (const candidate of [{ ...response, unavailable: undefined }, { ...response, unavailable: { ...response.unavailable, operationId: 'other' } },
    { ...response, unavailable: { ...response.unavailable, reason: 'failed' } }, { ...response, error: { ...response.error, retryable: true } }]) {
    expect(() => parseVideoOperation(candidate, 'operation-1')).toThrow();
    try { parseVideoOperation(candidate, 'operation-1'); } catch (error) { expect(error).not.toBeInstanceOf(VideoStatusUnavailable); }
  }
});
it('accepts the complete endpoint quote and refuses malformed or contradictory readiness', () => {
  expect(parseVideoPreflight(quote)).toEqual(quote);
  for (const patch of [{ version: 2 }, { ready: 'true' }, { blockers: ['Blocked'] }, { quoteId: '' }, { usdPerSecond: -1 }, { capability: { ...quote.capability, supportsAudio: true } }, { mode: 'live', usdPerSecond: null }]) {
    expect(() => parseVideoPreflight({ ...quote, ...patch })).toThrow(/malformed/);
  }
});
it('refuses image quotes with invalid limits, readiness or admission token', () => {
  const image = { mode: 'live', model: 'imagen', unitCost: 0.1, maxCost: 1, maxOutputs: 4, quoteId: 'a'.repeat(64), ready: true, blockers: [] };
  expect(parseStoryboardPreflight(image)).toEqual(image);
  for (const patch of [{ ready: 'yes' }, { maxOutputs: 100 }, { maxOutputs: 1.5 }, { unitCost: Infinity }, { maxCost: -1 }, { quoteId: 'untrusted' }, { blockers: ['blocked'] }]) expect(() => parseStoryboardPreflight({ ...image, ...patch })).toThrow(/malformed/);
});
it('binds status to exact operation and rejects fake ready, provenance and byte metadata', () => {
  const result = { ok: true, version: 1, mode: 'fixture', operation: { operationId: 'operation-1', providerOperationId: null, status: 'running', provider: 'fixture', model: 'fixture', capability, estimatedCost: 0, currency: 'USD', error: null, cancellationNote: null, clip: null } };
  expect(parseVideoOperation(result, 'operation-1')).toEqual(result);
  expect(() => parseVideoOperation(result, 'another-operation')).toThrow(/match/);
  for (const patch of [{ status: 'ready' }, { provider: 'different' }, { status: 'complete' }, { estimatedCost: -1 }]) expect(() => parseVideoOperation({ ...result, operation: { ...result.operation, ...patch } }, 'operation-1')).toThrow();
});
