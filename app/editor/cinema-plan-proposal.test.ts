import { describe, expect, it } from 'vitest';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
} from '../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from './canvas-commands';
import {
  cinemaProposalCanvasSource,
  cinemaPlanNeedsLayoutMigration,
  compileCinemaCanvasProposal,
  layoutCinemaProposalNodes,
  prepareCinemaPlanProposal,
} from './cinema-plan-proposal';
import { initialDocument } from './initial-document';
import { nodeRectangle, rectanglesOverlap } from './node-layout';

describe('cinema proposal canvas layout', () => {
  it('packs generated context and shot lanes without moving existing anchors', () => {
    const source = structuredClone(initialDocument);
    source.nodes.find((node) => node.id === 'story-premise')!.position = { x: 180, y: 540 };
    source.nodes.find((node) => node.id === 'scene-01')!.position = { x: 620, y: 640 };
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const runId = Object.keys(cinema.agentRuns)[0];
    const proposal = prepareCinemaPlanProposal(
      source,
      source.cinema,
      compileCinemaCanvasProposal(runId, cinema),
    );
    const applied = applyCanvasCommandProposal(cinemaProposalCanvasSource(source), proposal);
    const nodes = layoutCinemaProposalNodes(applied.document.nodes, cinema);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    expect(nodeById.get('story-premise')!.position).toEqual({ x: 180, y: 540 });
    expect(nodeById.get('scene-01')!.position).toEqual({ x: 620, y: 640 });

    const scene = cinema.scenes[cinema.activeSceneId!];
    const contextIds = [
      ...Object.values(cinema.agentRuns).map((run) => run.nodeId),
      ...Object.values(cinema.characters).map((character) => character.nodeId),
      ...Object.values(cinema.assets).map((asset) => asset.nodeId),
    ];
    const shotIds = scene.shotIds.map((shotId) => cinema.shots[shotId].nodeId);

    for (const ids of [contextIds, shotIds]) {
      for (let index = 1; index < ids.length; index += 1) {
        const previous = nodeById.get(ids[index - 1])!;
        const current = nodeById.get(ids[index])!;
        expect(rectanglesOverlap(nodeRectangle(previous), nodeRectangle(current), 24)).toBe(false);
        expect(current.position.y).toBeGreaterThan(previous.position.y);
      }
    }

    const widestContextRight = Math.max(...contextIds.map((id) => {
      const rectangle = nodeRectangle(nodeById.get(id)!);
      return rectangle.x + rectangle.width;
    }));
    const firstShotLeft = Math.min(...shotIds.map((id) => nodeById.get(id)!.position.x));
    expect(firstShotLeft - widestContextRight).toBeGreaterThanOrEqual(100);
  });

  it('detects and upgrades the legacy fixed-height plan layout', () => {
    const source = structuredClone(initialDocument);
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const prepared = prepareCinemaPlanProposal(source, source.cinema, MOCK_SHOT_PLAN_PROPOSAL);
    const applied = applyCanvasCommandProposal(cinemaProposalCanvasSource(source), prepared);

    expect(cinemaPlanNeedsLayoutMigration(applied.document.nodes, cinema)).toBe(true);
    const migrated = layoutCinemaProposalNodes(applied.document.nodes, cinema);
    expect(cinemaPlanNeedsLayoutMigration(migrated, cinema)).toBe(false);
  });
});
