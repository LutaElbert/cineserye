import { describe, expect, it, vi } from 'vitest';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { CinemaTraceEvent } from './telemetry';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from './workflow';

function brief(overrides: Partial<ScenePlanningBrief> = {}): ScenePlanningBrief {
  return {
    version: 1,
    sceneNodeId: 'scene-01',
    sceneText: 'Mara enters an abandoned cinema and sees her immediate future on screen.',
    tone: 'Claustrophobic supernatural suspense',
    locationPeriod: 'Manila single-screen cinema · late 1980s',
    budgetBand: 'micro',
    currency: 'PHP',
    budgetCeiling: 900,
    targetDurationSeconds: 42,
    availableEquipment: ['phone camera', 'tripod'],
    ...overrides,
  };
}

describe('fixture cinema planning workflow', () => {
  it('runs research then planning and returns a validated prompt package', async () => {
    const events: CinemaTraceEvent[] = [];
    const result = await runCinemaPlanningWorkflow(
      brief(),
      fixtureWorkflowDependencies(events.push.bind(events)),
      new AbortController().signal,
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('fixture');
    expect(result.sourceCount).toBe(5);
    expect(result.proposal.commands.length).toBeGreaterThan(10);
    expect(Object.keys(result.cinema.shots)).toHaveLength(6);
    expect(Object.values(result.cinema.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(42);
    expect(result.cinema.scenes['scene-01'].brief).toMatchObject({
      tone: 'Claustrophobic supernatural suspense',
      budgetCeiling: 900,
      targetDurationSeconds: 42,
    });
    expect(Object.values(result.cinema.agentRuns)[0]).toMatchObject({
      status: 'ready',
      researchProvider: 'fixture',
      planningProvider: 'fixture',
    });
    expect(events.map((event) => event.event)).toEqual([
      'run-started',
      'phase-completed',
      'phase-completed',
      'phase-completed',
      'phase-completed',
      'run-completed',
    ]);
    expect(JSON.stringify(events)).not.toContain(brief().sceneText);
    expect(JSON.stringify(events)).not.toContain('Claustrophobic');
  });

  it('is deterministic apart from run identifiers and timestamps', async () => {
    const first = await runCinemaPlanningWorkflow(
      brief(),
      fixtureWorkflowDependencies(() => undefined),
      new AbortController().signal,
    );
    const second = await runCinemaPlanningWorkflow(
      brief(),
      fixtureWorkflowDependencies(() => undefined),
      new AbortController().signal,
    );

    expect(Object.values(first.cinema.shots).map((shot) => shot.durationSeconds)).toEqual(
      Object.values(second.cinema.shots).map((shot) => shot.durationSeconds),
    );
    expect(Object.values(first.cinema.prompts).map((prompt) => prompt.generatedText)).toEqual(
      Object.values(second.cinema.prompts).map((prompt) => prompt.generatedText),
    );
  });

  it('cancels without calling either provider', async () => {
    const dependencies = fixtureWorkflowDependencies(() => undefined);
    const research = vi.spyOn(dependencies.researchProvider, 'research');
    const planning = vi.spyOn(dependencies.shotPlannerProvider, 'plan');
    const controller = new AbortController();
    controller.abort('user');

    await expect(runCinemaPlanningWorkflow(brief(), dependencies, controller.signal)).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    expect(research).not.toHaveBeenCalled();
    expect(planning).not.toHaveBeenCalled();
  });
});
