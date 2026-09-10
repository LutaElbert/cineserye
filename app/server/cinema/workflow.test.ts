import { describe, expect, it, vi } from 'vitest';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { CinemaTraceEvent } from './telemetry';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from './workflow';
import { ProviderError } from './provider-errors';

function brief(overrides: Partial<ScenePlanningBrief> = {}): ScenePlanningBrief {
  return {
    version: 2,
    sceneNodeId: 'scene-01',
    sceneText: 'Mara enters an abandoned cinema and sees her immediate future on screen.',
    creationMode: 'ai-generated',
    aspectRatio: '9:16',
    targetPlatform: 'short-form',
    genreTone: 'Claustrophobic supernatural suspense',
    locationPeriod: 'Manila single-screen cinema · late 1980s',
    dialogueAudioIntent: 'sound-design-led',
    targetDurationSeconds: 42,
    requiredBeats: ['Projector wakes'],
    mustInclude: ['Flashlight'],
    mustAvoid: ['Gore'],
    generationBudget: { pricingMode: 'currency', currency: 'PHP', ceiling: 900, maxAttempts: 2 },
    productionConstraints: {
      budgetBand: 'micro', currency: 'PHP', budgetCeiling: 25_000,
      availableEquipment: ['phone camera', 'tripod'],
    },
    ...overrides,
  };
}

describe('fixture cinema planning workflow', () => {
  it('never automatically repeats an uncertain live research dispatch', async () => {
    const dependencies = fixtureWorkflowDependencies(() => undefined);
    dependencies.mode = 'live';
    const research = vi.spyOn(dependencies.researchProvider, 'research').mockRejectedValue(new ProviderError('PROVIDER_UNAVAILABLE', 'Unknown outcome', true));
    await expect(runCinemaPlanningWorkflow(brief(), dependencies, new AbortController().signal)).rejects.toThrow();
    expect(research).toHaveBeenCalledTimes(1);
  });
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
      genreTone: 'Claustrophobic supernatural suspense',
      generationBudget: { ceiling: 900 },
      productionConstraints: { budgetCeiling: 25_000 },
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
