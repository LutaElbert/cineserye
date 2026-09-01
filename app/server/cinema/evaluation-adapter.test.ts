import { describe, expect, it } from 'vitest';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from './workflow';
import { createCinemaEvaluationArtifact } from './evaluation-adapter';

describe('cinema evaluation adapter', () => {
  it('exports versioned run, provider, scoring, and no-content trace metadata', async () => {
    const brief: ScenePlanningBrief = {
      version: 2,
      sceneNodeId: 'scene-01',
      sceneText: 'Mara enters an abandoned cinema.',
      creationMode: 'ai-generated',
      aspectRatio: '9:16',
      targetPlatform: 'short-form',
      genreTone: 'Restrained suspense',
      locationPeriod: 'Manila, late 1980s',
      dialogueAudioIntent: 'sound-design-led',
      targetDurationSeconds: 36,
      requiredBeats: ['Projector awakens'],
      mustInclude: ['Flashlight'],
      mustAvoid: ['Gore'],
      generationBudget: { pricingMode: 'currency', currency: 'PHP', ceiling: 1_200, maxAttempts: 2 },
      productionConstraints: {
        budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: ['phone camera'],
      },
    };
    const result = await runCinemaPlanningWorkflow(
      brief,
      fixtureWorkflowDependencies(() => undefined),
      new AbortController().signal,
      'eval-run-0001',
    );
    const artifact = createCinemaEvaluationArtifact('period-suspense', 'sprint-2-v1', brief, result);
    expect(artifact).toMatchObject({
      version: 1,
      datasetVersion: 'sprint-2-v1',
      traceId: 'eval-run-0001',
      agentVersion: 'scene-planner-v1',
      telemetryPolicy: 'no-content-v1',
      scoringPolicy: 'schema-citations-continuity-duration-budget-mutation-v1',
    });
    expect(artifact.trace.every((event) => JSON.stringify(event).includes(brief.sceneText) === false)).toBe(true);
  });
});
