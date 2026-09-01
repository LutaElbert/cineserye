import { describe, expect, it } from 'vitest';
import {
  createEmptyCinemaProjectData,
  removeCinemaRecordsForNodes,
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
          tone: 'Restrained suspense', locationPeriod: 'Manila, late 1980s', budgetBand: 'micro' as const,
          currency: 'PHP' as const, budgetCeiling: 1_200, targetDurationSeconds: 6,
          availableEquipment: ['phone camera', 'tripod'],
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
        queryPurpose: 'Period prop reference', status: 'pinned' as const, isMock: true, retrievedAt,
      },
    },
    costs: {
      'cost-01': {
        id: 'cost-01', runId: 'run-01', sceneId: 'scene-01', currency: 'PHP' as const,
        minimum: 100, expected: 200, highRisk: 300, ceiling: 1_200,
        isIllustrative: true as const, assumptions: ['Two attempts'],
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

  it('preserves JSON-safe namespaced extension fields', () => {
    const value = completeCinemaData();
    value['x-cineserye-test'] = { enabled: true };
    expect(validateCinemaProjectData(value, hostNodeIds)['x-cineserye-test']).toEqual({ enabled: true });
  });

  it('rejects unsupported future versions', () => {
    const value = { ...completeCinemaData(), schemaVersion: 2 };
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
