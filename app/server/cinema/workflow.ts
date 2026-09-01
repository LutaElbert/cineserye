import { validateCinemaProjectData } from '../../domain/cinema/project-data';
import { validateScenePlanningBrief, type ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { PlanSceneSuccess } from '../../features/scene-planner/plan-scene-api';
import { FixtureResearchProvider, FixtureShotPlannerProvider } from './fixture-providers';
import type { ResearchProvider, ShotPlannerProvider } from './provider-contracts';
import { ProviderError } from './provider-errors';
import { runProviderOperation } from './provider-resilience';
import { compileFixtureCanvasProposal } from './proposal-compiler';
import {
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
): Promise<PlanSceneSuccess> {
  const brief = validateScenePlanningBrief(untrustedBrief);
  const runId = crypto.randomUUID();
  const sink = dependencies.traceSink ?? consoleCinemaTraceSink;
  const startedAt = performance.now();
  sink({ event: 'run-started', runId, status: 'ok' });
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
    const proposal = compileFixtureCanvasProposal(runId, planning.cinema);
    const hostNodeIds = new Set([
      'story-premise',
      'scene-01',
      ...proposal.commands.flatMap((command) => command.type === 'create-node' ? [command.node.id] : []),
    ]);
    const cinema = validateCinemaProjectData(planning.cinema, hostNodeIds);
    sink({
      event: 'phase-completed', runId, phase: 'validation', status: 'ok',
      resultCount: Object.keys(cinema.shots).length,
    });
    sink({
      event: 'phase-completed', runId, phase: 'proposal', status: 'ok',
      resultCount: proposal.commands.length,
    });
    sink({
      event: 'run-completed', runId, status: 'ok',
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
    };
  } catch (error) {
    sink({
      event: 'run-failed', runId, status: 'error',
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      errorCode: error instanceof ProviderError ? error.code : 'UNEXPECTED',
    });
    throw error;
  }
}
