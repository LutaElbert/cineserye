import { describe, expect, it } from 'vitest';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { initialDocument } from '../../editor/initial-document';
import {
  MOCK_SHOT_PLAN_PROPOSAL,
  REEL_KNOWS_TOMORROW,
} from '../../domain/cinema/mock/reel-knows-tomorrow';
import { buildCinemaOutline } from './outline-model';

describe('buildCinemaOutline', () => {
  const proposal = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL);
  const proposedIds = new Set(proposal.affectedNodeIds);

  it('derives production groups and chronological shots from the proposal document', () => {
    const outline = buildCinemaOutline(
      proposal.document.nodes,
      REEL_KNOWS_TOMORROW,
      proposedIds,
    );

    expect(outline.project?.title).toBe('The Reel That Knows Tomorrow');
    expect(outline.scene.title).toBe('Scene 01 · The Abandoned Cinema');
    expect(outline.groups.map((group) => group.label)).toEqual([
      'Planning',
      'Characters',
      'Locations',
      'Props',
      'Visual Elements',
      'Shots',
    ]);
    expect(outline.groups.find((group) => group.id === 'props')?.items.map((item) => item.title)).toEqual([
      'Metal Flashlight',
      'Vintage Projector',
    ]);
    expect(outline.groups.find((group) => group.id === 'shots')?.items.map((item) => item.title)).toEqual([
      '01 · Entering the Auditorium',
      '02 · Projector Awakens',
      '03 · The Impossible Film',
      '04 · Someone Behind Her',
      '05 · Empty Auditorium',
      '06 · The Figure Moves Closer',
    ]);
    expect(outline.shotCount).toBe(6);
    expect(outline.targetDurationSeconds).toBe(36);
    expect(outline.expectedCost).toBe(820);
    expect(outline.totalItemCount).toBe(14);
  });

  it('filters production items without changing the underlying document', () => {
    const outline = buildCinemaOutline(
      proposal.document.nodes,
      REEL_KNOWS_TOMORROW,
      proposedIds,
      'projector',
    );

    expect(outline.groups.map((group) => group.label)).toEqual(['Props', 'Shots']);
    expect(outline.groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      'Vintage Projector',
      '02 · Projector Awakens',
    ]);
    expect(outline.visibleItemCount).toBe(2);
    expect(proposal.document.nodes).toHaveLength(14);
  });
});
