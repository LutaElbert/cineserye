import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { PlanSceneSuccess } from '../../features/scene-planner/plan-scene-api';
import { CINEMA_AGENT_VERSION, CINEMA_TELEMETRY_POLICY } from './telemetry';

export type CinemaEvaluationArtifactV1 = {
  version: 1;
  datasetVersion: string;
  evalCaseId: string;
  traceId: string;
  agentVersion: string;
  providerMode: 'fixture' | 'live';
  providerConfiguration: {
    researchProvider: string;
    planningProvider: string;
    model: string;
  };
  scoringPolicy: string;
  telemetryPolicy: 'no-content-v1';
  input: {
    brief: ScenePlanningBrief;
  };
  output: {
    cinema: PlanSceneSuccess['cinema'];
    warnings: string[];
  };
  trace: PlanSceneSuccess['trace'];
};

/** Explicit export contract for later Agents CLI generate/grade integration. */
export function createCinemaEvaluationArtifact(
  evalCaseId: string,
  datasetVersion: string,
  brief: ScenePlanningBrief,
  result: PlanSceneSuccess,
): CinemaEvaluationArtifactV1 {
  const run = result.cinema.agentRuns[result.runId];
  if (!run) throw new Error('Evaluation export requires the matching agent run.');
  return {
    version: 1,
    datasetVersion,
    evalCaseId,
    traceId: result.runId,
    agentVersion: CINEMA_AGENT_VERSION,
    providerMode: result.mode,
    providerConfiguration: {
      researchProvider: run.researchProvider,
      planningProvider: run.planningProvider,
      model: run.model,
    },
    scoringPolicy: 'schema-citations-continuity-duration-budget-mutation-v1',
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
    input: { brief: structuredClone(brief) },
    output: { cinema: structuredClone(result.cinema), warnings: [...result.warnings] },
    trace: structuredClone(result.trace),
  };
}
