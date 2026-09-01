import { validateCinemaProjectData } from '../../domain/cinema/project-data';
import { scopeCinemaProjectDataForRun } from '../../domain/cinema/revision-scope';
import { validateScenePlanningBrief, type ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { PlanSceneSuccess } from '../../features/scene-planner/plan-scene-api';
import { FixtureResearchProvider, FixtureShotPlannerProvider } from './fixture-providers';
import type { ResearchProvider, ShotPlannerProvider } from './provider-contracts';
import { ProviderError } from './provider-errors';
import { runProviderOperation } from './provider-resilience';
import { compileCinemaCanvasProposal } from './proposal-compiler';
import {
  CINEMA_AGENT_VERSION,
  CINEMA_TELEMETRY_POLICY,
  consoleCinemaTraceSink,
  traceCinemaPhase,
  type CinemaTraceSink,
} from './telemetry';

export type CinemaWorkflowDependencies = {
  mode: 'fixture' | 'live';
  researchProvider: ResearchProvider;
  shotPlannerProvider: ShotPlannerProvider;
  traceSink?: CinemaTraceSink;
};

export function fixtureWorkflowDependencies(traceSink?: CinemaTraceSink): CinemaWorkflowDependencies {
  return {
    mode: 'fixture',
    researchProvider: new FixtureResearchProvider(),
    shotPlannerProvider: new FixtureShotPlannerProvider(),
    traceSink,
  };
}

export async function runCinemaPlanningWorkflow(
  untrustedBrief: ScenePlanningBrief,
  dependencies: CinemaWorkflowDependencies,
  signal: AbortSignal,
  requestedRunId?: string,
): Promise<PlanSceneSuccess> {
  const brief = validateScenePlanningBrief(untrustedBrief);
  const runId = requestedRunId ?? crypto.randomUUID();
  const trace = [] as Parameters<NonNullable<CinemaWorkflowDependencies['traceSink']>>[0][];
  const externalSink = dependencies.traceSink ?? consoleCinemaTraceSink;
  const sink: CinemaTraceSink = (event) => {
    trace.push(structuredClone(event));
    externalSink(event);
  };
  const startedAt = performance.now();
  sink({
    event: 'run-started', runId, status: 'ok',
    agentVersion: CINEMA_AGENT_VERSION,
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
  });
  try {
    const research = await traceCinemaPhase(
      sink,
      { runId, phase: 'research' },
      () => runProviderOperation(
        (attemptSignal) => dependencies.researchProvider.research({ runId, brief, signal: attemptSignal }),
        { signal, timeoutMs: 15_000, maxAttempts: 2 },
      ),
      (result) => ({ provider: result.provider, resultCount: result.sources.length }),
    );
    const planning = await traceCinemaPhase(
      sink,
      { runId, phase: 'planning' },
      () => runProviderOperation(
        (attemptSignal) => dependencies.shotPlannerProvider.plan({
          runId,
          brief,
          research,
          signal: attemptSignal,
        }),
        { signal, timeoutMs: 30_000, maxAttempts: 2 },
      ),
      (result) => ({ provider: result.provider, model: result.model, resultCount: Object.keys(result.cinema.shots).length }),
    );
    const scopedCinema = scopeCinemaProjectDataForRun(planning.cinema, runId);
    const proposal = compileCinemaCanvasProposal(runId, scopedCinema);
    const hostNodeIds = new Set(
      proposal.commands.flatMap((command) => command.type === 'create-node' ? [command.node.id] : []),
    );
    if (scopedCinema.projectNodeId) hostNodeIds.add(scopedCinema.projectNodeId);
    for (const scene of Object.values(scopedCinema.scenes)) hostNodeIds.add(scene.nodeId);
    const cinema = validateCinemaProjectData(scopedCinema, hostNodeIds);
    sink({
      event: 'phase-completed', runId, phase: 'validation', status: 'ok',
      agentVersion: CINEMA_AGENT_VERSION,
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      resultCount: Object.keys(cinema.shots).length,
    });
    sink({
      event: 'phase-completed', runId, phase: 'proposal', status: 'ok',
      agentVersion: CINEMA_AGENT_VERSION,
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      resultCount: proposal.commands.length,
    });
    sink({
      event: 'run-completed', runId, status: 'ok',
      agentVersion: CINEMA_AGENT_VERSION,
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      resultCount: Object.keys(cinema.shots).length,
    });
    return {
      ok: true,
      version: 1,
      mode: dependencies.mode,
      runId,
      proposal,
      cinema,
      sourceCount: research.sources.length,
      warnings: [...new Set([...research.warnings, ...planning.warnings])],
      trace,
    };
  } catch (error) {
    sink({
      event: 'run-failed', runId, status: 'error',
      agentVersion: CINEMA_AGENT_VERSION,
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      errorCode: error instanceof ProviderError ? error.code : 'UNEXPECTED',
    });
    throw error;
  }
}
