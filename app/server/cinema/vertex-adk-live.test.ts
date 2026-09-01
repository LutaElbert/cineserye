import { describe, expect, it } from 'vitest';
import { validateCinemaProjectData } from '../../domain/cinema/project-data';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { initialDocument } from '../../editor/initial-document';
import { compileCinemaCanvasProposal } from './proposal-compiler';
import type { ShotPlannerProviderRequest } from './provider-contracts';
import { VertexAdkShotPlannerProvider } from './vertex-adk-shot-planner';

const runLive = process.env.CINESERYE_RUN_VERTEX_SMOKE === '1';

describe.skipIf(!runLive)('Vertex ADK live smoke', () => {
  it('returns a structured, compilable one-scene plan through local ADC', async () => {
    const request: ShotPlannerProviderRequest = {
      runId: crypto.randomUUID(),
      brief: {
        version: 2,
        sceneNodeId: 'scene-01',
        sceneText: 'At a closed neighborhood bakery, a young owner finds one warm loaf labeled with tomorrow’s date.',
        creationMode: 'ai-generated',
        aspectRatio: '9:16',
        targetPlatform: 'short-form',
        genreTone: 'Hopeful magical realism',
        locationPeriod: 'Contemporary Quezon City bakery before dawn',
        dialogueAudioIntent: 'sound-design-led',
        targetDurationSeconds: 24,
        requiredBeats: ['Tomorrow label is discovered'],
        mustInclude: ['Warm loaf'],
        mustAvoid: ['Visible brands'],
        generationBudget: { pricingMode: 'currency', currency: 'PHP', ceiling: 1_000, maxAttempts: 2 },
        productionConstraints: {
          budgetBand: 'micro', currency: 'PHP', budgetCeiling: null,
          availableEquipment: ['Phone camera', 'Tripod', 'One warm practical light'],
        },
      },
      research: {
        provider: 'smoke-fixture',
        sources: [{
          id: 'smoke-source-01',
          runId: '',
          title: 'Small bakery production reference',
          publisher: 'Local smoke fixture',
          url: 'https://example.com/bakery-reference',
          finding: 'A prep counter, bread rack, paper label, and one warm work light create reusable visual anchors.',
          queryPurpose: 'Minimal one-location production design',
          status: 'supported',
          creatorPinned: false,
          isMock: true,
          retrievedAt: '2026-09-01T00:00:00.000Z',
        }],
        warnings: ['The live smoke uses a local research fixture and does not call Parallel.'],
      },
      signal: new AbortController().signal,
    };
    request.research.sources[0].runId = request.runId;
    const provider = new VertexAdkShotPlannerProvider(
      process.env.GOOGLE_CLOUD_PROJECT ?? 'cineserye',
      process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
      process.env.CINESERYE_VERTEX_MODEL ?? 'gemini-3.7-flash',
    );

    let result;
    try {
      result = await provider.plan(request);
    } catch (error) {
      if (error instanceof Error && error.cause instanceof Error) {
        throw new Error(error.cause.message, { cause: error });
      }
      throw error;
    }

    expect(Object.keys(result.cinema.shots).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(result.cinema.shots).length).toBeLessThanOrEqual(8);
    expect(Object.values(result.cinema.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0)).toBe(24);
    expect(result.cinema.agentRuns[request.runId]).toMatchObject({
      planningProvider: 'vertex-adk',
      status: 'ready',
    });
    const proposal = compileCinemaCanvasProposal(request.runId, result.cinema);
    const applied = applyCanvasCommandProposal(initialDocument, proposal);
    expect(() => validateCinemaProjectData(
      result.cinema,
      new Set(applied.document.nodes.map((node) => node.id)),
    )).not.toThrow();
  }, 120_000);
});
