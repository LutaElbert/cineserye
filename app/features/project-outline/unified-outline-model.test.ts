import { describe, expect, it } from 'vitest';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
} from '../../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { initialDocument } from '../../editor/initial-document';
import { conceptTitleFromPlainText } from '../../editor/rich-text';
import type { EditorEdge, EditorNode } from '../../editor/types';
import { buildUnifiedProjectOutline } from './unified-outline-model';

function concept(id: string, role: 'story' | 'scene' | 'shot' | 'note', name: string): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    style: { width: 220, height: 80 },
    data: {
      kind: 'concept', domainType: `cinema.${role}`, name, label: name,
      title: conceptTitleFromPlainText(name), body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: role, tone: role === 'shot' ? 'mint' : role === 'story' ? 'indigo' : 'ink',
      collapsed: false, horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function edge(id: string, source: string, target: string): EditorEdge {
  return { id, source, target, data: { label: '', kind: 'default', relationship: 'hierarchy' } };
}

function acceptedDocument() {
  const document = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
  document.cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  return document;
}

describe('unified project outline projection', () => {
  it('shows draft hierarchy immediately with production-style groups and statuses', () => {
    const nodes = [
      concept('story', 'story', 'Story Premise'),
      concept('scene', 'scene', 'Scene 01'),
      concept('shot-1', 'shot', 'Shot 01'),
      concept('shot-2', 'shot', 'Shot 02'),
    ];
    const model = buildUnifiedProjectOutline(nodes, [
      edge('story-scene', 'story', 'scene'),
      edge('scene-shot-1', 'scene', 'shot-1'),
      edge('scene-shot-2', 'scene', 'shot-2'),
    ], undefined, new Set());

    expect(model.project?.title).toBe('Story Premise');
    expect(model.scenes).toHaveLength(1);
    expect(model.scenes[0].shotCount).toBe(2);
    expect(model.scenes[0].expectedCostLabel).toBe('Draft');
    expect(model.scenes[0].groups.find((group) => group.id === 'shots')?.items).toMatchObject([
      { title: 'Shot 01', statusLabel: 'Draft', state: 'draft' },
      { title: 'Shot 02', statusLabel: 'Draft', state: 'draft' },
    ]);
  });

  it('enriches accepted records without replacing their graph position', () => {
    const document = acceptedDocument();
    const model = buildUnifiedProjectOutline(document.nodes, document.edges, document.cinema, new Set());
    const scene = model.scenes[0];

    expect(model.project?.title).toBe('The Reel That Knows Tomorrow');
    expect(scene.item.title).toBe('Scene 01 · The Abandoned Cinema');
    expect(scene.item.statusLabel).toBe('Accepted');
    expect(scene.shotCount).toBe(6);
    expect(scene.targetDurationSeconds).toBe(36);
    expect(scene.expectedCostLabel).toBe('₱820');
    expect(scene.groups.map((group) => group.label)).toEqual([
      'Planning', 'Characters', 'Locations', 'Props', 'Visual Elements', 'Shots',
    ]);
    expect(scene.groups.find((group) => group.id === 'shots')?.items.every((item) => (
      item.state === 'production' && item.statusLabel === 'Prompts ready'
    ))).toBe(true);
  });

  it('adds a connected manual shot to accepted totals exactly once', () => {
    const document = acceptedDocument();
    document.nodes.push(concept('manual-shot-07', 'shot', 'Shot 07'));
    document.edges.push(edge('scene-shot-07', 'scene-01', 'manual-shot-07'));
    const model = buildUnifiedProjectOutline(document.nodes, document.edges, document.cinema, new Set());
    const shots = model.scenes[0].groups.find((group) => group.id === 'shots')!.items;

    expect(model.scenes[0].shotCount).toBe(7);
    expect(shots.filter((item) => item.nodeId === 'manual-shot-07')).toEqual([
      expect.objectContaining({ statusLabel: 'Draft', state: 'draft' }),
    ]);
  });

  it('renders deterministic multi-scene groups and repeats shared entities by stable identity', () => {
    const document = acceptedDocument();
    const nextScene = concept('scene-02', 'scene', 'Scene 02');
    document.nodes.push(nextScene);
    document.edges.push(edge('story-scene-02', 'story-premise', 'scene-02'));
    const cinema = structuredClone(document.cinema!);
    const firstSceneId = cinema.sceneOrder[0];
    cinema.scenes['scene-record-02'] = {
      ...structuredClone(cinema.scenes[firstSceneId]),
      id: 'scene-record-02', nodeId: 'scene-02', title: 'Scene 02', shotIds: [], brief: null,
    };
    cinema.sceneOrder.push('scene-record-02');
    const mara = Object.values(cinema.characters).find((character) => character.title === 'Mara')!;
    mara.sceneIds.push('scene-record-02');

    const model = buildUnifiedProjectOutline(document.nodes, document.edges, cinema, new Set());
    expect(model.scenes.map((scene) => scene.item.title)).toEqual([
      'Scene 01 · The Abandoned Cinema', 'Scene 02',
    ]);
    expect(model.scenes.map((scene) => scene.groups.find((group) => group.id === 'characters')?.items[0])).toEqual([
      expect.objectContaining({ nodeId: mara.nodeId, statusLabel: 'Shared' }),
      expect.objectContaining({ nodeId: mara.nodeId, statusLabel: 'Shared' }),
    ]);
  });

  it('keeps disconnected typed nodes visible under Needs attention and searchable with ancestors', () => {
    const nodes = [
      concept('story', 'story', 'Midnight Signal'),
      concept('scene', 'scene', 'Scene 01'),
      concept('shot', 'shot', 'Flashlight Reveal'),
      concept('orphan', 'shot', 'Missing Parent'),
    ];
    const edges = [edge('story-scene', 'story', 'scene'), edge('scene-shot', 'scene', 'shot')];
    const model = buildUnifiedProjectOutline(nodes, edges, undefined, new Set(), 'flashlight');
    const complete = buildUnifiedProjectOutline(nodes, edges, undefined, new Set());

    expect(model.project?.title).toBe('Midnight Signal');
    expect(model.scenes[0].item.title).toBe('Scene 01');
    expect(model.scenes[0].groups[0].items[0].title).toBe('Flashlight Reveal');
    expect(complete.unassigned).toEqual([
      expect.objectContaining({ nodeId: 'orphan', state: 'attention', statusLabel: 'Needs parent' }),
    ]);
  });

  it('keeps the five-hundred-node projection within its local performance budget', () => {
    const nodes = [concept('story', 'story', 'Story')];
    const edges: EditorEdge[] = [];
    for (let sceneIndex = 0; sceneIndex < 10; sceneIndex += 1) {
      const sceneId = `scene-${sceneIndex}`;
      nodes.push(concept(sceneId, 'scene', `Scene ${sceneIndex + 1}`));
      edges.push(edge(`story-${sceneId}`, 'story', sceneId));
      for (let shotIndex = 0; shotIndex < 49; shotIndex += 1) {
        const shotId = `${sceneId}-shot-${shotIndex}`;
        nodes.push(concept(shotId, 'shot', `Shot ${shotIndex + 1}`));
        edges.push(edge(`${sceneId}-${shotId}`, sceneId, shotId));
      }
    }
    const startedAt = performance.now();
    const model = buildUnifiedProjectOutline(nodes, edges, undefined, new Set());
    expect(model.totalItemCount).toBe(501);
    expect(model.scenes).toHaveLength(10);
    expect(performance.now() - startedAt).toBeLessThan(150);
  });
});
