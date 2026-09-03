import { describe, expect, it } from 'vitest';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
} from '../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from './canvas-commands';
import { resolveCinemaHierarchyInsertion } from './cinema-hierarchy';
import { initialDocument } from './initial-document';
import { nodeRectangle, rectanglesOverlap } from './node-layout';
import { conceptTitleFromPlainText } from './rich-text';
import { planAcceptedCinemaDraftInsertion } from './cinema-workspace-placement';
import type { EditorEdge, EditorNode } from './types';

function draft(id: string, role: 'scene' | 'shot'): EditorNode {
  const label = role === 'scene' ? 'Scene 02' : 'Shot 07';
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    style: { width: 220, height: 68 },
    draggable: true,
    deletable: true,
    data: {
      kind: 'concept', domainType: `cinema.${role}`, name: label, label,
      title: conceptTitleFromPlainText(label), body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: role, tone: role === 'shot' ? 'mint' : 'ink', collapsed: false,
      horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function acceptedDocument() {
  const document = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
  document.cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  return document;
}

describe('accepted cinema additive layout', () => {
  it('places a manual shot below its scene without moving accepted hosts', () => {
    const document = acceptedDocument();
    const newShot = draft('manual-shot-07', 'shot');
    const insertion = resolveCinemaHierarchyInsertion(document.nodes, document.edges, 'scene-01', 'shot');
    const before = structuredClone(document.nodes.map((node) => ({ id: node.id, position: node.position })));
    const position = planAcceptedCinemaDraftInsertion(
      document.nodes, document.edges, document.cinema, insertion, 'shot', newShot,
    );

    expect(position).not.toBeNull();
    expect(position!.x).toBe(document.nodes.find((node) => node.id === 'scene-01')!.position.x);
    expect(document.nodes.map((node) => ({ id: node.id, position: node.position }))).toEqual(before);
    const placed = { ...newShot, position: position! };
    expect(document.nodes.some((node) => rectanglesOverlap(nodeRectangle(placed), nodeRectangle(node), 44))).toBe(false);
  });

  it('places the next scene below the complete accepted workspace and manual shot', () => {
    const document = acceptedDocument();
    const manualShot = draft('manual-shot-07', 'shot');
    const shotInsertion = resolveCinemaHierarchyInsertion(document.nodes, document.edges, 'scene-01', 'shot');
    manualShot.position = planAcceptedCinemaDraftInsertion(
      document.nodes, document.edges, document.cinema, shotInsertion, 'shot', manualShot,
    )!;
    const shotEdge: EditorEdge = {
      id: 'scene-manual-shot', source: 'scene-01', target: manualShot.id,
      data: { label: '', kind: 'default', relationship: 'hierarchy' },
    };
    const nodes = [...document.nodes, manualShot];
    const edges = [...document.edges, shotEdge];
    const newScene = draft('manual-scene-02', 'scene');
    const insertion = resolveCinemaHierarchyInsertion(nodes, edges, 'scene-01', 'scene');
    const position = planAcceptedCinemaDraftInsertion(nodes, edges, document.cinema, insertion, 'scene', newScene);

    expect(position).not.toBeNull();
    const placed = { ...newScene, position: position! };
    expect(nodes.some((node) => rectanglesOverlap(nodeRectangle(placed), nodeRectangle(node), 44))).toBe(false);
    expect(position!.y).toBeGreaterThan(Math.max(...nodes.map((node) => (
      node.position.y + nodeRectangle(node).height
    ))));
  });

  it('leaves an unplanned document to the generic hierarchy layout', () => {
    const newScene = draft('manual-scene-02', 'scene');
    const insertion = resolveCinemaHierarchyInsertion(initialDocument.nodes, initialDocument.edges, 'scene-01', 'scene');
    expect(planAcceptedCinemaDraftInsertion(
      initialDocument.nodes, initialDocument.edges, undefined, insertion, 'scene', newScene,
    )).toBeNull();
  });
});
