import { ProviderError } from './provider-errors';

export type CinemaProviderMode = 'fixture' | 'live';

export type CinemaProviderConfig = {
  mode: CinemaProviderMode;
  parallelApiKey: string | null;
  googleCloudProject: string;
  googleCloudLocation: string;
  vertexModel: string;
  cloudTelemetryEnabled: boolean;
  expectedGoogleAccount: 'elbertluta@gmail.com';
  activeGoogleAccount: string | null;
  adcQuotaProject: string | null;
  liveExecutionEnabled: boolean;
  maxLiveRunCost: number | null;
};

type Environment = Record<string, string | undefined>;

export function readCinemaProviderConfig(environment: Environment = process.env): CinemaProviderConfig {
  const mode = environment.CINESERYE_E2E_FIXTURE === 'true'
    ? 'fixture'
    : environment.CINESERYE_PROVIDER_MODE ?? 'fixture';
  if (mode !== 'fixture' && mode !== 'live') {
    throw new ProviderError('INVALID_CONFIGURATION', 'Cineserye provider mode is invalid.');
  }
  const configuredMaxCost = environment.CINESERYE_LIVE_MAX_RUN_COST?.trim();
  const maxLiveRunCost = configuredMaxCost ? Number(configuredMaxCost) : null;
  if (maxLiveRunCost !== null && (!Number.isFinite(maxLiveRunCost) || maxLiveRunCost <= 0)) {
    throw new ProviderError('INVALID_CONFIGURATION', 'The live provider run ceiling is invalid.');
  }
  const config: CinemaProviderConfig = {
    mode,
    parallelApiKey: environment.PARALLEL_API_KEY?.trim() || null,
    googleCloudProject: environment.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
    googleCloudLocation: environment.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    vertexModel: environment.CINESERYE_VERTEX_MODEL?.trim() || 'gemini-3.7-flash',
    cloudTelemetryEnabled: environment.CINESERYE_ENABLE_CLOUD_TELEMETRY === 'true',
    expectedGoogleAccount: 'elbertluta@gmail.com',
    activeGoogleAccount: environment.CINESERYE_GCLOUD_ACTIVE_ACCOUNT?.trim() || null,
    adcQuotaProject: environment.GOOGLE_CLOUD_QUOTA_PROJECT?.trim() || null,
    liveExecutionEnabled: environment.CINESERYE_LIVE_ENABLED === 'true',
    maxLiveRunCost,
  };
  if (mode === 'live') {
    if (!config.parallelApiKey) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Parallel research is not configured.');
    }
    if (!config.googleCloudProject) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Google Cloud planning is not configured.');
    }
  }
  return config;
}

export function applyCinemaTelemetryPrivacyBaseline(
  config: CinemaProviderConfig,
  environment: Environment = process.env,
) {
  if (config.cloudTelemetryEnabled) return;
  environment.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = 'NO_CONTENT';
  environment.ADK_CAPTURE_MESSAGE_CONTENT_IN_SPANS = 'false';
  delete environment.OTEL_INSTRUMENTATION_GENAI_COMPLETION_HOOK;
}

export function assertLiveProviderConsent(config: CinemaProviderConfig, consent: unknown) {
  if (config.mode === 'live' && consent !== true) {
    throw new ProviderError(
      'INVALID_REQUEST',
      'Confirm the live provider content transfer before planning.',
    );
  }
}
