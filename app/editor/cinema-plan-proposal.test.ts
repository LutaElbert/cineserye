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
import { ensureStoryProject } from './story-development-commands';

describe('cinema proposal canvas layout', () => {
  it('replaces the starter shot after a durable project owner is initialized', () => {
    const source = ensureStoryProject(structuredClone(initialDocument));
    const runId = Object.keys(MOCK_CINEMA_PROJECT_DATA.agentRuns)[0];
    const preserved = prepareCinemaPlanProposal(
      source,
      source.cinema,
      compileCinemaCanvasProposal(runId, MOCK_CINEMA_PROJECT_DATA),
    );
    const proposal = prepareCinemaPlanProposal(source, source.cinema, MOCK_SHOT_PLAN_PROPOSAL, { replaceStarterShot: true });
    const deletion = proposal.commands.find((command) => command.type === 'delete-nodes');

    expect(source.cinema?.projectId).toBeTruthy();
    expect(source.cinema?.activeRevisionId).toBeNull();
    expect(preserved.commands.some((command) => command.type === 'delete-nodes')).toBe(false);
    expect(deletion).toMatchObject({ type: 'delete-nodes', ids: ['shot-01'] });
  });

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
    expect(nodeById.get('story-premise')!.data).toEqual(source.nodes.find((node) => node.id === 'story-premise')!.data);
    expect(nodeById.get('scene-01')!.data).toEqual(source.nodes.find((node) => node.id === 'scene-01')!.data);

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

  it('repacks displaced generated lanes around the persisted scene anchor', () => {
    const source = structuredClone(initialDocument);
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const applied = applyCanvasCommandProposal(
      cinemaProposalCanvasSource(source),
      prepareCinemaPlanProposal(source, source.cinema, MOCK_SHOT_PLAN_PROPOSAL),
    );
    const expected = layoutCinemaProposalNodes(applied.document.nodes, cinema);
    const generatedIds = new Set([
      ...Object.values(cinema.agentRuns).map((run) => run.nodeId),
      ...Object.values(cinema.characters).map((character) => character.nodeId),
      ...Object.values(cinema.assets).map((asset) => asset.nodeId),
      ...Object.values(cinema.shots).map((shot) => shot.nodeId),
    ]);
    const displaced = expected.map((node) => generatedIds.has(node.id)
      ? { ...node, position: { x: node.position.x + 480, y: node.position.y + 260 } }
      : node);
    const repaired = layoutCinemaProposalNodes(displaced, cinema);
    const expectedById = new Map(expected.map((node) => [node.id, node.position]));

    expect(repaired.find((node) => node.id === 'story-premise')!.position).toEqual(
      displaced.find((node) => node.id === 'story-premise')!.position,
    );
    expect(repaired.find((node) => node.id === 'scene-01')!.position).toEqual(
      displaced.find((node) => node.id === 'scene-01')!.position,
    );
    for (const id of generatedIds) {
      expect(repaired.find((node) => node.id === id)!.position).toEqual(expectedById.get(id));
    }
  });
});
