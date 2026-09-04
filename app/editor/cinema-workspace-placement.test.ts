import { describe, expect, it } from 'vitest';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
} from '../domain/cinema/mock/reel-knows-tomorrow';
import type { CinemaDraftRole } from '../domain/cinema/manual-creation';
import { applyCanvasCommandProposal } from './canvas-commands';
import { initialDocument } from './initial-document';
import { nodeRectangle, rectanglesOverlap } from './node-layout';
import { conceptTitleFromPlainText } from './rich-text';
import { planCinemaDraftInsertion } from './cinema-workspace-placement';
import type { EditorEdge, EditorNode } from './types';

function draft(id: string, draftRole: CinemaDraftRole): EditorNode {
  const label = `${draftRole} draft`;
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    style: { width: 220, height: 68 },
    draggable: true,
    deletable: true,
    data: {
      kind: 'concept', domainType: `cinema.${draftRole}`, name: label, label,
      title: conceptTitleFromPlainText(label), body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: draftRole, tone: draftRole === 'shot' ? 'mint' : 'ink', collapsed: false,
      horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function acceptedDocument() {
  const document = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
  document.cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  return document;
}

function expectCollisionFree(nodes: EditorNode[], node: EditorNode, position: { x: number; y: number }) {
  const placed = { ...node, position };
  expect(nodes.some((candidate) => rectanglesOverlap(
    nodeRectangle(placed), nodeRectangle(candidate), 44,
  ))).toBe(false);
}

function hierarchyEdge(id: string, source: string, target: string): EditorEdge {
  return { id, source, target, data: { label: '', kind: 'default', relationship: 'hierarchy' } };
}

describe('parent-aware cinema insertion', () => {
  it('appends scene and shot siblings in horizontal parent lanes without moving existing nodes', () => {
    const before = structuredClone(initialDocument.nodes.map((node) => ({ id: node.id, position: node.position })));
    const scene = draft('scene-02', 'scene');
    const scenePlacement = planCinemaDraftInsertion(
      initialDocument.nodes, initialDocument.edges, undefined,
      { parentId: 'story-premise' }, 'scene', scene,
    )!;
    const shot = draft('shot-02', 'shot');
    const shotPlacement = planCinemaDraftInsertion(
      initialDocument.nodes, initialDocument.edges, undefined,
      { parentId: 'scene-01' }, 'shot', shot,
    )!;

    expect(scenePlacement.direction).toBe('horizontal');
    expect(scenePlacement.sourceHandle).toBeUndefined();
    expect(scenePlacement.targetHandle).toBeUndefined();
    expect(scenePlacement.position.x).toBe(initialDocument.nodes.find((node) => node.id === 'scene-01')!.position.x);
    expect(scenePlacement.position.y).toBeGreaterThan(initialDocument.nodes.find((node) => node.id === 'scene-01')!.position.y);
    expect(shotPlacement.direction).toBe('horizontal');
    expect(shotPlacement.position.x).toBe(initialDocument.nodes.find((node) => node.id === 'shot-01')!.position.x);
    expectCollisionFree(initialDocument.nodes, scene, scenePlacement.position);
    expectCollisionFree(initialDocument.nodes, shot, shotPlacement.position);
    expect(initialDocument.nodes.map((node) => ({ id: node.id, position: node.position }))).toEqual(before);
  });

  it('joins accepted shot, prop, and scene lanes while keeping accepted hosts fixed', () => {
    const document = acceptedDocument();
    const before = structuredClone(document.nodes.map((node) => ({ id: node.id, position: node.position })));
    const cases: Array<{ role: CinemaDraftRole; parentId: string; laneNodeId: string }> = [
      { role: 'shot', parentId: 'scene-01', laneNodeId: 'cine-shot-01' },
      { role: 'prop', parentId: 'scene-01', laneNodeId: 'cine-asset-projector' },
      { role: 'scene', parentId: 'story-premise', laneNodeId: 'scene-01' },
    ];

    for (const item of cases) {
      const node = draft(`manual-${item.role}`, item.role);
      const placement = planCinemaDraftInsertion(
        document.nodes, document.edges, document.cinema,
        { parentId: item.parentId }, item.role, node,
      )!;
      expect(placement.direction).toBe('horizontal');
      expect(placement.position.x).toBe(document.nodes.find((candidate) => candidate.id === item.laneNodeId)!.position.x);
      expectCollisionFree(document.nodes, node, placement.position);
    }
    expect(document.nodes.map((node) => ({ id: node.id, position: node.position }))).toEqual(before);
  });

  it('applies the same parent route policy to every production layer and notes', () => {
    for (const draftRole of ['character', 'location', 'prop', 'visual-element', 'note'] as const) {
      const node = draft(`manual-${draftRole}`, draftRole);
      const placement = planCinemaDraftInsertion(
        initialDocument.nodes, initialDocument.edges, undefined,
        { parentId: 'scene-01' }, draftRole, node,
      )!;
      expect(placement.direction).toBe('horizontal');
      expect(placement.sourceHandle).toBeUndefined();
      expect(placement.targetHandle).toBeUndefined();
      expect(placement.position.x).toBeGreaterThan(initialDocument.nodes.find((candidate) => candidate.id === 'scene-01')!.position.x);
      expectCollisionFree(initialDocument.nodes, node, placement.position);
    }
  });

  it('centers a draft scene against three shots and shifts its later draft scene band', () => {
    const scene02 = { ...draft('scene-02', 'scene'), position: { x: 450, y: 322 } };
    const scene03 = { ...draft('scene-03', 'scene'), position: { x: 450, y: 434 } };
    const shot07 = { ...draft('shot-07', 'shot'), position: { x: 770, y: 322 } };
    const shot08 = { ...draft('shot-08', 'shot'), position: { x: 770, y: 434 } };
    const nodes = [...initialDocument.nodes, scene02, scene03, shot07, shot08];
    const edges = [
      ...initialDocument.edges,
      hierarchyEdge('story-scene-02', 'story-premise', 'scene-02'),
      hierarchyEdge('story-scene-03', 'story-premise', 'scene-03'),
      hierarchyEdge('scene-02-shot-07', 'scene-02', 'shot-07'),
      hierarchyEdge('scene-02-shot-08', 'scene-02', 'shot-08'),
    ];
    const shot09 = draft('shot-09', 'shot');
    const placement = planCinemaDraftInsertion(
      nodes, edges, undefined, { parentId: 'scene-02' }, 'shot', shot09,
    )!;
    const scenePosition = placement.positions.get('scene-02')!;
    const sceneCenter = scenePosition.y + 34;
    const groupTop = shot07.position.y;
    const groupBottom = placement.position.y + 68;

    expect(placement.position.x).toBe(shot07.position.x);
    expect(sceneCenter).toBe((groupTop + groupBottom) / 2);
    expect(placement.positions.get('scene-03')!.y).toBeGreaterThan(groupBottom);
    expect(placement.positions.has('story-premise')).toBe(false);
    expect(placement.positions.has('scene-01')).toBe(false);
  });

  it('places a new scene below the preceding scene complete subtree', () => {
    const lowNote = { ...draft('low-note', 'note'), position: { x: 770, y: 700 } };
    const nodes = [...initialDocument.nodes, lowNote];
    const edges = [...initialDocument.edges, hierarchyEdge('scene-note', 'scene-01', 'low-note')];
    const nextScene = draft('scene-02', 'scene');
    const placement = planCinemaDraftInsertion(
      nodes, edges, undefined, { parentId: 'story-premise' }, 'scene', nextScene,
    )!;
    expect(placement.position.y).toBeGreaterThan(lowNote.position.y + 68);
  });

  it('does not center an accepted or locked scene host', () => {
    const accepted = acceptedDocument();
    const acceptedPlacement = planCinemaDraftInsertion(
      accepted.nodes, accepted.edges, accepted.cinema,
      { parentId: 'scene-01' }, 'note', draft('accepted-note', 'note'),
    )!;
    expect(acceptedPlacement.positions.has('scene-01')).toBe(false);

    const lockedScene = {
      ...initialDocument.nodes.find((node) => node.id === 'scene-01')!,
      data: { ...initialDocument.nodes.find((node) => node.id === 'scene-01')!.data, locked: true },
    };
    const nodes = initialDocument.nodes.map((node) => node.id === lockedScene.id ? lockedScene : node);
    const lockedPlacement = planCinemaDraftInsertion(
      nodes, initialDocument.edges, undefined,
      { parentId: 'scene-01' }, 'shot', draft('locked-shot', 'shot'),
    )!;
    expect(lockedPlacement.positions.has('scene-01')).toBe(false);
  });

  it('preserves an explicit vertical legacy branch and places its next sibling across the row', () => {
    const verticalEdge: EditorEdge = {
      ...initialDocument.edges[0], sourceHandle: 'bottom', targetHandle: 'top',
    };
    const scene = draft('scene-02', 'scene');
    const placement = planCinemaDraftInsertion(
      initialDocument.nodes, [verticalEdge, initialDocument.edges[1]], undefined,
      { parentId: 'story-premise' }, 'scene', scene,
    )!;

    expect(placement).toMatchObject({ direction: 'vertical', sourceHandle: 'bottom', targetHandle: 'top' });
    expect(placement.position.y).toBe(initialDocument.nodes.find((node) => node.id === 'scene-01')!.position.y);
    expect(placement.position.x).toBeGreaterThan(initialDocument.nodes.find((node) => node.id === 'scene-01')!.position.x);
    expectCollisionFree(initialDocument.nodes, scene, placement.position);
  });

  it('ignores reference and sequence edges when inferring the parent route', () => {
    const distractingEdges: EditorEdge[] = [
      {
        id: 'reference', source: 'story-premise', target: 'shot-01',
        sourceHandle: 'bottom', targetHandle: 'top', data: { relationship: 'reference', kind: 'default', label: '' },
      },
      ...initialDocument.edges,
    ];
    const placement = planCinemaDraftInsertion(
      initialDocument.nodes, distractingEdges, undefined,
      { parentId: 'story-premise' }, 'scene', draft('scene-02', 'scene'),
    )!;
    expect(placement.direction).toBe('horizontal');
  });

  it('returns null when the semantic parent is unavailable', () => {
    expect(planCinemaDraftInsertion(
      initialDocument.nodes, initialDocument.edges, undefined,
      { parentId: 'missing' }, 'note', draft('note-02', 'note'),
    )).toBeNull();
  });
});
