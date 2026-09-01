import { ProviderError } from './provider-errors';

export type CinemaProviderMode = 'fixture' | 'live';

export type CinemaProviderConfig = {
  mode: CinemaProviderMode;
  parallelApiKey: string | null;
  googleCloudProject: string;
  googleCloudLocation: string;
  vertexModel: string;
};

type Environment = Record<string, string | undefined>;

export function readCinemaProviderConfig(environment: Environment = process.env): CinemaProviderConfig {
  const mode = environment.CINESERYE_PROVIDER_MODE ?? 'fixture';
  if (mode !== 'fixture' && mode !== 'live') {
    throw new ProviderError('INVALID_CONFIGURATION', 'Cineserye provider mode is invalid.');
  }
  const config: CinemaProviderConfig = {
    mode,
    parallelApiKey: environment.PARALLEL_API_KEY?.trim() || null,
    googleCloudProject: environment.GOOGLE_CLOUD_PROJECT?.trim() || 'cineserye',
    googleCloudLocation: environment.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    vertexModel: environment.CINESERYE_VERTEX_MODEL?.trim() || 'gemini-3.7-flash',
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
