import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA, MOCK_SHOT_PLAN_PROPOSAL } from '../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from './canvas-commands';
import { applyCinemaDomainCommand } from './cinema-domain-commands';
import { initialDocument } from './initial-document';

describe('cinema domain command boundary', () => {
  it('updates an accepted shot and locked host atomically while marking owned prompts stale', () => {
    const applied = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL);
    const source = { ...applied.document, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    const shotId = source.cinema.scenes['scene-01'].shotIds[0];
    const shot = source.cinema.shots[shotId];
    const historicalDuration = source.cinema.revisions[source.cinema.activeRevisionId ?? '']
      .snapshot.shots[shotId].durationSeconds;
    const result = applyCinemaDomainCommand(source, {
      type: 'update-shot',
      shotId,
      patch: { title: 'Revised entrance', durationSeconds: 8, framing: 'Medium wide' },
    });
    expect(result.cinema?.shots[shotId]).toMatchObject({
      title: 'Revised entrance', durationSeconds: 8, framing: 'Medium wide',
    });
    const host = result.nodes.find((node) => node.id === shot.nodeId);
    expect(host).toMatchObject({ draggable: false, deletable: false });
    expect(host?.data).toMatchObject({ label: '01 · Revised entrance' });
    expect(Object.values(result.cinema?.prompts ?? {}).filter((prompt) => prompt.ownerNodeId === shot.nodeId)
      .every((prompt) => prompt.status === 'stale')).toBe(true);
    expect(result.cinema?.revisions[result.cinema.activeRevisionId ?? '']
      .snapshot.shots[shotId].durationSeconds).toBe(historicalDuration);
  });

  it('rejects invalid edits without mutating the source', () => {
    const applied = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL);
    const source = { ...applied.document, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    const before = structuredClone(source);
    const shotId = source.cinema.scenes['scene-01'].shotIds[0];
    expect(() => applyCinemaDomainCommand(source, {
      type: 'update-shot', shotId, patch: { durationSeconds: -1 },
    })).toThrow('duration');
    expect(source).toEqual(before);
  });

  it('S5-IT-01 applies batch table edits as one validated domain transaction', () => {
    const applied = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL);
    const source = { ...applied.document, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    const [firstId, secondId] = source.cinema.scenes['scene-01'].shotIds;
    const result = applyCinemaDomainCommand(source, {
      type: 'batch-update-shots',
      updates: [
        { shotId: firstId, patch: { durationSeconds: 5, framing: 'Wide master' } },
        { shotId: secondId, patch: { durationSeconds: 7, audio: 'Projector ignition' } },
      ],
    });
    expect(result.cinema?.shots[firstId]).toMatchObject({ durationSeconds: 5, framing: 'Wide master' });
    expect(result.cinema?.shots[secondId]).toMatchObject({ durationSeconds: 7, audio: 'Projector ignition' });
    expect(source.cinema.shots[firstId].durationSeconds).not.toBe(5);
  });

  it('updates production order, setup, status, and continuity through the command boundary', () => {
    const applied = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL);
    const source = { ...applied.document, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    const scene = source.cinema.scenes['scene-01'];
    const setupId = 'setup-scene-01-night';
    const first = applyCinemaDomainCommand(source, {
      type: 'upsert-production-setup',
      setup: {
        id: setupId, sceneId: scene.id, name: 'Night inserts', camera: 'Phone camera', lens: '2×',
        lighting: 'Projector practical', location: 'Auditorium', equipment: ['tripod'], notes: '',
        estimatedSetupMinutes: 15, shotIds: [],
      },
    });
    const second = applyCinemaDomainCommand(first, {
      type: 'assign-shots-to-setup', shotIds: [scene.shotIds[0]], setupId,
    });
    const third = applyCinemaDomainCommand(second, {
      type: 'reorder-production-shot', shotId: scene.shotIds.at(-1)!, toIndex: 0,
    });
    const fourth = applyCinemaDomainCommand(third, {
      type: 'set-production-status', shotIds: [scene.shotIds[0]], status: 'ready',
    });
    const continuityNodeId = source.cinema.shots[scene.shotIds[0]].continuityNodeIds[0];
    const result = applyCinemaDomainCommand(fourth, {
      type: 'set-continuity-state', shotId: scene.shotIds[0], entityNodeId: continuityNodeId, state: 'screen-left',
    });

    expect(result.cinema?.professionalPlanning?.shots[scene.shotIds[0]]).toMatchObject({ setupId, status: 'ready' });
    expect(result.cinema?.professionalPlanning?.shots[scene.shotIds.at(-1)!].productionOrder).toBe(1);
    expect(result.cinema?.professionalPlanning?.continuityStates[scene.shotIds[0]][continuityNodeId]).toBe('screen-left');
    expect(result.cinema?.scenes['scene-01'].shotIds).toEqual(scene.shotIds);
  });
});
