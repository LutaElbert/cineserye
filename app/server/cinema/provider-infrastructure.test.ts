import { describe, expect, it, vi } from 'vitest';
import {
  applyCinemaTelemetryPrivacyBaseline,
  assertLiveProviderConsent,
  readCinemaProviderConfig,
} from './provider-config';
import { ProviderError, publicProviderError } from './provider-errors';
import { runProviderOperation } from './provider-resilience';
import { traceCinemaPhase, type CinemaTraceEvent } from './telemetry';
import { assertCinemaLivePreflight, buildCinemaLivePreflight } from './live-preflight';
import { createCinemaConsentReceipt } from '../../domain/cinema/live-consent';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';

describe('cinema provider infrastructure', () => {
  it('defaults to deterministic fixture mode without credentials', () => {
    expect(readCinemaProviderConfig({})).toEqual({
      mode: 'fixture',
      parallelApiKey: null,
      googleCloudProject: 'cineserye',
      googleCloudLocation: 'global',
      vertexModel: 'gemini-3.7-flash',
      cloudTelemetryEnabled: false,
      expectedGoogleAccount: 'elbertluta@gmail.com',
      activeGoogleAccount: null,
      adcQuotaProject: null,
      liveExecutionEnabled: false,
      maxLiveRunCost: null,
    });
  });

  it('S9-SEC-01 fails closed until the exact account, project, quota project, ceiling, and kill switch match', () => {
    const blocked = readCinemaProviderConfig({ CINESERYE_PROVIDER_MODE: 'live', PARALLEL_API_KEY: 'test-key' });
    expect(buildCinemaLivePreflight(blocked)).toMatchObject({ ready: false, killSwitchEnabled: false });
    expect(buildCinemaLivePreflight(blocked).blockers).toContain('Active Google account must be elbertluta@gmail.com.');

    const ready = readCinemaProviderConfig({
      CINESERYE_PROVIDER_MODE: 'live', PARALLEL_API_KEY: 'test-key',
      CINESERYE_GCLOUD_ACTIVE_ACCOUNT: 'elbertluta@gmail.com',
      GOOGLE_CLOUD_PROJECT: 'cineserye', GOOGLE_CLOUD_QUOTA_PROJECT: 'cineserye',
      CINESERYE_LIVE_ENABLED: 'true', CINESERYE_LIVE_MAX_RUN_COST: '2.5',
    });
    expect(buildCinemaLivePreflight(ready)).toMatchObject({ ready: true, maxLiveRunCost: 2.5 });
  });

  it('S9-IT-01 binds consent to the exact brief and rejects stale or over-ceiling receipts', () => {
    const config = readCinemaProviderConfig({
      CINESERYE_PROVIDER_MODE: 'live', PARALLEL_API_KEY: 'test-key',
      CINESERYE_GCLOUD_ACTIVE_ACCOUNT: 'elbertluta@gmail.com', GOOGLE_CLOUD_PROJECT: 'cineserye',
      GOOGLE_CLOUD_QUOTA_PROJECT: 'cineserye', CINESERYE_LIVE_ENABLED: 'true', CINESERYE_LIVE_MAX_RUN_COST: '3',
    });
    const brief: ScenePlanningBrief = {
      version: 2, sceneNodeId: 'scene-01', sceneText: 'Mara enters.', creationMode: 'ai-generated', aspectRatio: '9:16',
      targetPlatform: 'short-form', genreTone: 'Suspense', locationPeriod: 'Manila, 1988', dialogueAudioIntent: 'mixed',
      targetDurationSeconds: 12, requiredBeats: [], mustInclude: [], mustAvoid: [],
      generationBudget: { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 1 },
      productionConstraints: { budgetBand: 'micro', currency: 'PHP', budgetCeiling: 1_000, availableEquipment: [] },
    };
    const receipt = createCinemaConsentReceipt(brief, 3, '2026-09-02T08:00:00.000Z', config.vertexModel);
    expect(() => assertCinemaLivePreflight(config, brief, true, receipt)).not.toThrow();
    expect(() => assertCinemaLivePreflight(config, { ...brief, sceneText: 'Changed.' }, true, receipt)).toThrow('does not match');
    expect(() => assertCinemaLivePreflight(config, brief, true, { ...receipt, approvedMaxCost: 4 })).toThrow();
    expect(() => assertCinemaLivePreflight(config, brief, true, { ...receipt, planningModel: 'different-model' })).toThrow('does not match');
  });

  it('disables content capture and completion upload unless cloud telemetry is explicitly enabled', () => {
    const environment: Record<string, string | undefined> = {
      OTEL_INSTRUMENTATION_GENAI_COMPLETION_HOOK: 'upload',
    };
    applyCinemaTelemetryPrivacyBaseline(readCinemaProviderConfig(environment), environment);
    expect(environment).toMatchObject({
      OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'NO_CONTENT',
      ADK_CAPTURE_MESSAGE_CONTENT_IN_SPANS: 'false',
    });
    expect(environment.OTEL_INSTRUMENTATION_GENAI_COMPLETION_HOOK).toBeUndefined();

    const optedIn = { CINESERYE_ENABLE_CLOUD_TELEMETRY: 'true', OTEL_INSTRUMENTATION_GENAI_COMPLETION_HOOK: 'upload' };
    applyCinemaTelemetryPrivacyBaseline(readCinemaProviderConfig(optedIn), optedIn);
    expect(optedIn.OTEL_INSTRUMENTATION_GENAI_COMPLETION_HOOK).toBe('upload');
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

  it('requires explicit content-transfer consent only in live mode', () => {
    expect(() => assertLiveProviderConsent(readCinemaProviderConfig({}), false)).not.toThrow();
    const liveConfig = readCinemaProviderConfig({
      CINESERYE_PROVIDER_MODE: 'live',
      PARALLEL_API_KEY: 'configured-for-test',
    });
    expect(() => assertLiveProviderConsent(liveConfig, false)).toThrow('Confirm the live provider');
    expect(() => assertLiveProviderConsent(liveConfig, true)).not.toThrow();
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
