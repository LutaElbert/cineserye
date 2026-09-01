import { ParallelResearchProvider } from './parallel-research-provider';
import type { CinemaProviderConfig } from './provider-config';
import { ProviderError } from './provider-errors';
import type { CinemaTraceSink } from './telemetry';
import { VertexAdkShotPlannerProvider } from './vertex-adk-shot-planner';
import type { CinemaWorkflowDependencies } from './workflow';

export function liveWorkflowDependencies(
  config: CinemaProviderConfig,
  traceSink?: CinemaTraceSink,
): CinemaWorkflowDependencies {
  if (!config.parallelApiKey) {
    throw new ProviderError('INVALID_CONFIGURATION', 'Parallel research is not configured.');
  }
  return {
    mode: 'live',
    researchProvider: new ParallelResearchProvider(config.parallelApiKey),
    shotPlannerProvider: new VertexAdkShotPlannerProvider(
      config.googleCloudProject,
      config.googleCloudLocation,
      config.vertexModel,
    ),
    traceSink,
  };
}
