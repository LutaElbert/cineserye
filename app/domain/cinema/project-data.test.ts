import { describe, expect, it } from 'vitest';
import {
  acceptCinemaPlanRevision,
  compareCinemaPlanRevisions,
  curateCinemaResearchSource,
  createEmptyCinemaProjectData,
  removeCinemaRecordsForNodes,
  supportedCitationIds,
  type CinemaProjectDataV1,
  validateCinemaProjectData,
} from './project-data';

const retrievedAt = '2026-09-01T02:00:00.000Z';

function completeCinemaData(): CinemaProjectDataV1 {
  return {
    schemaVersion: 1 as const,
    projectNodeId: 'story-premise',
    activeSceneId: 'scene-01',
    sceneOrder: ['scene-01'],
    scenes: {
      'scene-01': {
        id: 'scene-01', nodeId: 'scene-01', title: 'The Abandoned Cinema',
        synopsis: 'Mara discovers an impossible film.', dramaticPurpose: 'Reveal the threat.',
        status: 'draft' as const, continuityNotes: 'Keep the projector screen-right.',
        brief: {
          version: 2, creationMode: 'ai-generated', aspectRatio: '9:16', targetPlatform: 'short-form',
          genreTone: 'Restrained suspense', locationPeriod: 'Manila, late 1980s',
          dialogueAudioIntent: 'sound-design-led', targetDurationSeconds: 6,
          requiredBeats: ['Projector starts'], mustInclude: ['Projector'], mustAvoid: ['Gore'],
          generationBudget: { pricingMode: 'currency', currency: 'PHP', ceiling: 1_200, maxAttempts: 2 },
          productionConstraints: {
            budgetBand: 'micro', currency: 'PHP', budgetCeiling: null,
            availableEquipment: ['phone camera', 'tripod'],
          },
        },
        shotIds: ['shot-01'],
      },
    },
    shots: {
      'shot-01': {
        id: 'shot-01', nodeId: 'shot-01', sceneId: 'scene-01', order: 1,
        title: 'Projector awakens', description: 'The reels begin to turn.', purpose: 'Reveal the event.',
        framing: 'Extreme close-up', cameraMovement: 'Slow push', lensMm: null, durationSeconds: 6,
        audio: 'Mechanical click', risk: 'medium' as const, continuityNodeIds: ['asset-projector'],
        generationStatus: 'planned' as const,
      },
    },
    characters: {},
    assets: {
      'asset-projector': {
        id: 'asset-projector', nodeId: 'asset-projector', sceneIds: ['scene-01'], title: 'Projector',
        category: 'prop' as const, summary: 'Hero prop', continuityNotes: 'Two exposed reels',
        source: 'planned' as const, uri: '', provenance: 'Research-backed proposal',
      },
    },
    agentRuns: {
      'run-01': {
        id: 'run-01', nodeId: 'run-01', sceneId: 'scene-01', status: 'accepted' as const,
        summary: 'One-shot fixture', proposedCommandCount: 3, researchProvider: 'fixture',
        planningProvider: 'fixture', model: 'fixture-v1', sourceIds: ['source-01'], promptIds: ['prompt-01'],
        warnings: [], startedAt: retrievedAt, completedAt: retrievedAt,
      },
    },
    prompts: {
      'prompt-01': {
        id: 'prompt-01', ownerNodeId: 'shot-01', runId: 'run-01', label: 'Video prompt',
        purpose: 'video' as const, providerProfile: 'generic', generatedText: 'A projector wakes.',
        negativeConstraints: ['No modern controls'], continuityNodeIds: ['asset-projector'],
        researchSourceIds: ['source-01'], version: 1, status: 'draft' as const,
      },
    },
    sources: {
      'source-01': {
        id: 'source-01', runId: 'run-01', title: '35mm projector anatomy', publisher: 'Fixture',
        url: 'https://example.test/projector', finding: 'Exposed reels make the mechanism readable.',
        queryPurpose: 'Period prop reference', status: 'supported' as const,
        creatorPinned: false, isMock: true, retrievedAt,
      },
    },
    costs: {
      'cost-01': {
        id: 'cost-01', runId: 'run-01', sceneId: 'scene-01', pricingMode: 'currency', currency: 'PHP' as const,
        minimum: 100, expected: 200, highRisk: 300, ceiling: 1_200,
        isIllustrative: true as const, assumptionProfileVersion: 1, provider: 'fixture', model: 'fixture-v1',
        resolution: '9:16', outputCount: 1, retryAllowance: 1, pricingSnapshotDate: null,
        assumptions: ['Two attempts'],
      },
    },
  };
}

const hostNodeIds = new Set(['story-premise', 'scene-01', 'shot-01', 'asset-projector', 'run-01']);

describe('cinema project data', () => {
  it('validates a complete, related cinema sidecar', () => {
    const result = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    expect(result.scenes['scene-01'].shotIds).toEqual(['shot-01']);
    expect(result.prompts['prompt-01'].researchSourceIds).toEqual(['source-01']);
  });

  it('creates an empty sidecar for a generic canvas', () => {
    expect(validateCinemaProjectData(createEmptyCinemaProjectData(), new Set())).toEqual(
      createEmptyCinemaProjectData(),
    );
  });

  it('migrates an accepted V1 plan into a deterministic immutable revision', () => {
    const first = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    const second = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    expect(first.schemaVersion).toBe(2);
    expect(first.projectId).toBe('cineserye-story-premise');
    expect(first).toEqual(second);
    expect(first.revisions[first.activeRevisionId ?? '']).toMatchObject({
      number: 1,
      predecessorRevisionId: null,
      status: 'active',
    });
  });

  it('accepts a successor revision while preserving and comparing its predecessor snapshot', () => {
    const current = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    const incoming = structuredClone(current);
    incoming.revisions = {};
    incoming.activeRevisionId = null;
    incoming.agentRuns['run-01'].status = 'ready';
    incoming.shots['shot-01'].durationSeconds = 8;
    incoming.shots['shot-01'].framing = 'Medium close-up';
    const next = acceptCinemaPlanRevision(current, incoming, '2026-09-01T03:00:00.000Z');
    const active = next.revisions[next.activeRevisionId ?? ''];
    const predecessor = next.revisions[active.predecessorRevisionId ?? ''];
    expect(active.number).toBe(2);
    expect(predecessor.status).toBe('superseded');
    expect(predecessor.snapshot.shots['shot-01'].durationSeconds).toBe(6);
    expect(compareCinemaPlanRevisions(predecessor, active)).toMatchObject({
      addedShots: 0,
      removedShots: 0,
      changedShots: 1,
      durationDeltaSeconds: 2,
    });
  });

  it('preserves JSON-safe namespaced extension fields', () => {
    const value = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    value['x-cineserye-test'] = { enabled: true };
    expect(validateCinemaProjectData(value, hostNodeIds)['x-cineserye-test']).toEqual({ enabled: true });
  });

  it('migrates legacy brief, source, and cost records without inventing production spend', () => {
    const value = completeCinemaData() as unknown as Record<string, unknown>;
    const scene = (value.scenes as Record<string, Record<string, unknown>>)['scene-01'];
    scene.brief = {
      tone: 'Restrained suspense', locationPeriod: 'Manila, late 1980s', budgetBand: 'micro',
      currency: 'PHP', budgetCeiling: 1_200, targetDurationSeconds: 6,
      availableEquipment: ['tripod'],
    };
    const source = (value.sources as Record<string, Record<string, unknown>>)['source-01'];
    source.status = 'pinned';
    delete source.creatorPinned;
    const cost = (value.costs as Record<string, Record<string, unknown>>)['cost-01'];
    delete cost.pricingMode;
    delete cost.assumptionProfileVersion;
    delete cost.provider;
    delete cost.model;
    delete cost.resolution;
    delete cost.outputCount;
    delete cost.retryAllowance;
    delete cost.pricingSnapshotDate;

    const result = validateCinemaProjectData(value, hostNodeIds);
    expect(result.scenes['scene-01'].brief).toMatchObject({
      version: 2,
      genreTone: 'Restrained suspense',
      generationBudget: { ceiling: 1_200 },
      productionConstraints: { budgetCeiling: null },
    });
    expect(result.sources['source-01']).toMatchObject({ status: 'supported', creatorPinned: true });
    expect(result.costs['cost-01']).toMatchObject({ pricingMode: 'currency', assumptionProfileVersion: 1 });
  });

  it('curates proposal sources without leaving fallback citation relationships', () => {
    const value = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    const verification = curateCinemaResearchSource(value, 'source-01', {
      type: 'set-status', status: 'needs-verification',
    });
    expect(supportedCitationIds(verification, ['source-01', 'missing-source'])).toEqual([]);
    const removed = curateCinemaResearchSource(verification, 'source-01', { type: 'remove' });
    expect(removed.sources).toEqual({});
    expect(removed.agentRuns['run-01'].sourceIds).toEqual([]);
    expect(removed.prompts['prompt-01'].researchSourceIds).toEqual([]);
  });

  it('rejects unsupported future versions', () => {
    const value = { ...completeCinemaData(), schemaVersion: 4 };
    expect(() => validateCinemaProjectData(value, hostNodeIds)).toThrow('unsupported cinema data version');
  });

  it('rejects an entity whose visual host node is missing', () => {
    const value = completeCinemaData();
    const missingAssetHost = new Set([...hostNodeIds].filter((nodeId) => nodeId !== 'asset-projector'));
    expect(() => validateCinemaProjectData(value, missingAssetHost)).toThrow('missing canvas node');
  });

  it('rejects orphaned shots after their scene is removed', () => {
    const value = completeCinemaData();
    value.scenes = {};
    value.sceneOrder = [];
    value.activeSceneId = null;
    expect(() => validateCinemaProjectData(value, hostNodeIds)).toThrow('Shot shot-01 refers to missing id scene-01');
  });

  it('rejects unresolved continuity relationships', () => {
    const value = completeCinemaData();
    value.shots['shot-01'].continuityNodeIds = ['missing-character'];
    expect(() => validateCinemaProjectData(value, hostNodeIds)).toThrow('missing continuity node');
  });

  it('rejects duplicate chronological shot orders', () => {
    const value = completeCinemaData();
    value.shots['shot-02'] = {
      ...value.shots['shot-01'],
      id: 'shot-02',
      nodeId: 'shot-02',
    };
    value.scenes['scene-01'].shotIds = ['shot-01', 'shot-02'];
    expect(() => validateCinemaProjectData(value, new Set([...hostNodeIds, 'shot-02']))).toThrow(
      'duplicate shot orders',
    );
  });

  it('rejects unordered cost ranges and preserves an over-ceiling estimate for warning UI', () => {
    const unordered = completeCinemaData();
    unordered.costs['cost-01'].minimum = 250;
    unordered.costs['cost-01'].expected = 200;
    expect(() => validateCinemaProjectData(unordered, hostNodeIds)).toThrow('ranges are out of order');

    const overCeiling = completeCinemaData();
    overCeiling.costs['cost-01'].ceiling = 250;
    expect(validateCinemaProjectData(overCeiling, hostNodeIds).costs['cost-01'].highRisk).toBe(300);
  });

  it('cascades scene removal without leaving cinema orphans', () => {
    const value = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    const remainingHosts = new Set([...hostNodeIds].filter((nodeId) => nodeId !== 'scene-01'));
    const result = removeCinemaRecordsForNodes(value, new Set(['scene-01']), remainingHosts);

    expect(result.activeSceneId).toBeNull();
    expect(result.sceneOrder).toEqual([]);
    expect(result.scenes).toEqual({});
    expect(result.shots).toEqual({});
    expect(result.agentRuns).toEqual({});
    expect(result.prompts).toEqual({});
    expect(result.sources).toEqual({});
    expect(result.costs).toEqual({});
    expect(result.assets['asset-projector'].sceneIds).toEqual([]);
  });

  it('prunes deleted continuity nodes from shots and prompts', () => {
    const value = validateCinemaProjectData(completeCinemaData(), hostNodeIds);
    const remainingHosts = new Set([...hostNodeIds].filter((nodeId) => nodeId !== 'asset-projector'));
    const result = removeCinemaRecordsForNodes(value, new Set(['asset-projector']), remainingHosts);

    expect(result.assets).toEqual({});
    expect(result.shots['shot-01'].continuityNodeIds).toEqual([]);
    expect(result.prompts['prompt-01'].continuityNodeIds).toEqual([]);
  });
});
