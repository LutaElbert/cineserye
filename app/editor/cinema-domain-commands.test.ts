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
});
