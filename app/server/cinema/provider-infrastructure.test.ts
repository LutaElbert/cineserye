import { describe, expect, it, vi } from 'vitest';
import { readCinemaProviderConfig } from './provider-config';
import { ProviderError, publicProviderError } from './provider-errors';
import { runProviderOperation } from './provider-resilience';
import { traceCinemaPhase, type CinemaTraceEvent } from './telemetry';

describe('cinema provider infrastructure', () => {
  it('defaults to deterministic fixture mode without credentials', () => {
    expect(readCinemaProviderConfig({})).toEqual({
      mode: 'fixture',
      parallelApiKey: null,
      googleCloudProject: 'cineserye',
      googleCloudLocation: 'global',
      vertexModel: 'gemini-3.7-flash',
    });
  });

  it('returns safe configuration errors without secret values', () => {
    expect(() => readCinemaProviderConfig({ CINESERYE_PROVIDER_MODE: 'live' })).toThrow(
      'Parallel research is not configured',
    );
    expect(publicProviderError(new Error('x-api-key: secret-value'))).toEqual({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'The planning service could not complete this request.',
      retryable: true,
    });
  });

  it('retries one retryable failure and then succeeds', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new ProviderError('RATE_LIMITED', 'Try again.', true))
      .mockResolvedValueOnce('ok');
    const result = await runProviderOperation((_signal, attempt) => operation(attempt), {
      signal: new AbortController().signal,
      timeoutMs: 100,
      maxAttempts: 2,
    });
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops after the bounded retry limit', async () => {
    const operation = vi.fn().mockRejectedValue(new ProviderError('RATE_LIMITED', 'Try again.', true));
    await expect(runProviderOperation(() => operation(), {
      signal: new AbortController().signal,
      timeoutMs: 100,
      maxAttempts: 2,
    })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('distinguishes cancellation from timeout', async () => {
    const cancelledController = new AbortController();
    cancelledController.abort('user');
    await expect(runProviderOperation(() => Promise.resolve('unused'), {
      signal: cancelledController.signal,
      timeoutMs: 10,
    })).rejects.toMatchObject({ code: 'CANCELLED' });

    await expect(runProviderOperation((signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }), {
      signal: new AbortController().signal,
      timeoutMs: 5,
      maxAttempts: 1,
    })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('emits content-free phase telemetry', async () => {
    const events: CinemaTraceEvent[] = [];
    await traceCinemaPhase(events.push.bind(events), { runId: 'run-01', phase: 'research' }, async () => ({
      provider: 'fixture',
      sources: ['secret scene text'],
    }), (result) => ({ provider: result.provider, resultCount: result.sources.length }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'phase-completed', runId: 'run-01', phase: 'research', provider: 'fixture', resultCount: 1,
    });
    expect(JSON.stringify(events)).not.toContain('secret scene text');
  });
});
