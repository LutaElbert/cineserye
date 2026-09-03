import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { conceptTitleFromPlainText } from './rich-text';
import { nodeRectangle, rectanglesOverlap } from './node-layout';
import {
  cinemaHierarchyParentId,
  cinemaHierarchyRootId,
  isCinemaHierarchyEdge,
  planCinemaHierarchyLayout,
  resolveCinemaHierarchyInsertion,
} from './cinema-hierarchy';
import type { EditorEdge, EditorNode } from './types';

function cinemaNode(id: string, role: 'story' | 'scene' | 'shot', x: number, y: number, width = 220, height = 68): EditorNode {
  const name = `${role} ${id}`;
  return {
    id,
    type: 'concept',
    position: { x, y },
    style: { width, height },
    data: {
      kind: 'concept', domainType: `cinema.${role}`, name, label: name,
      title: conceptTitleFromPlainText(name), body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: role, tone: role === 'shot' ? 'mint' : role === 'story' ? 'indigo' : 'ink',
      collapsed: false, horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function hierarchyEdge(id: string, source: string, target: string): EditorEdge {
  return { id, source, target, data: { label: '', kind: 'default', relationship: 'hierarchy' } };
}

describe('cinema hierarchy resolution', () => {
  it('classifies only valid hierarchy role pairs and safely recognizes legacy pairs', () => {
    const nodes = structuredClone(initialDocument.nodes);
    expect(isCinemaHierarchyEdge(nodes, { id: 'legacy', source: 'story-premise', target: 'scene-01', data: { label: '', kind: 'default' } })).toBe(true);
    expect(isCinemaHierarchyEdge(nodes, { id: 'sequence', source: 'scene-01', target: 'shot-01', data: { label: '', kind: 'default', relationship: 'sequence' } })).toBe(false);
    expect(isCinemaHierarchyEdge(nodes, { id: 'invalid', source: 'shot-01', target: 'scene-01', data: { label: '', kind: 'default', relationship: 'hierarchy' } })).toBe(false);
  });

  it('resolves a next scene to the Story and a next shot to the Scene', () => {
    const { nodes, edges } = structuredClone(initialDocument);
    expect(resolveCinemaHierarchyInsertion(nodes, edges, 'scene-01', 'scene')).toMatchObject({
      parentId: 'story-premise', rootId: 'story-premise', insertionIndex: 1,
    });
    expect(resolveCinemaHierarchyInsertion(nodes, edges, 'shot-01', 'shot')).toMatchObject({
      parentId: 'scene-01', rootId: 'story-premise', insertionIndex: 1,
    });
    expect(cinemaHierarchyRootId(nodes, edges, 'shot-01')).toBe('story-premise');
  });

  it('ignores unrelated incoming connectors and blocks ambiguous hierarchy parents', () => {
    const { nodes, edges } = structuredClone(initialDocument);
    const note = cinemaNode('other-story', 'story', 0, 0);
    nodes.push(note);
    edges.push({
      id: 'reference-to-shot', source: 'story-premise', target: 'shot-01',
      data: { label: 'reference', kind: 'dashed', relationship: 'reference' },
    });
    expect(cinemaHierarchyParentId(nodes, edges, 'shot-01', 'scene')).toBe('scene-01');
    edges.push(hierarchyEdge('second-story-parent', 'other-story', 'scene-01'));
    expect(() => resolveCinemaHierarchyInsertion(nodes, edges, 'scene-01', 'scene')).toThrow('multiple story parents');
  });
});

describe('ancestor-aware cinema hierarchy layout', () => {
  it('packs scene subtrees from the anchored Story without overlapping mixed-height shots', () => {
    const story = cinemaNode('story', 'story', 100, 80);
    const sceneOne = cinemaNode('scene-1', 'scene', 420, 80, 220, 90);
    const sceneTwo = cinemaNode('scene-2', 'scene', 700, 80, 220, 120);
    const shotOne = cinemaNode('shot-1', 'shot', 900, 80, 240, 90);
    const shotTwo = cinemaNode('shot-2', 'shot', 0, 0, 260, 170);
    const shotThree = cinemaNode('shot-3', 'shot', 0, 0, 220, 110);
    const nodes = [story, sceneOne, sceneTwo, shotOne, shotTwo, shotThree];
    const edges = [
      hierarchyEdge('story-scene-1', 'story', 'scene-1'),
      hierarchyEdge('story-scene-2', 'story', 'scene-2'),
      hierarchyEdge('scene-1-shot-1', 'scene-1', 'shot-1'),
      hierarchyEdge('scene-1-shot-2', 'scene-1', 'shot-2'),
      hierarchyEdge('scene-2-shot-3', 'scene-2', 'shot-3'),
    ];
    const result = planCinemaHierarchyLayout(nodes, edges, {
      parentId: 'scene-1', rootId: 'story', insertionIndex: 1, newNodeId: 'shot-2',
    });
    const laidOut = nodes.map((node) => ({ ...node, position: result.positions.get(node.id) ?? node.position }));

    expect(result.positions.get('story')).toBeUndefined();
    expect(laidOut.find((node) => node.id === 'story')?.position).toEqual({ x: 100, y: 80 });
    for (let left = 0; left < laidOut.length; left += 1) {
      for (let right = left + 1; right < laidOut.length; right += 1) {
        expect(rectanglesOverlap(nodeRectangle(laidOut[left]), nodeRectangle(laidOut[right]))).toBe(false);
      }
    }
    expect(result.hierarchyEdgeIds).toHaveLength(5);
  });

  it('keeps unrelated and locked nodes fixed while finding space for movable descendants', () => {
    const { nodes, edges } = structuredClone(initialDocument);
    const next = cinemaNode('shot-02', 'shot', 0, 0);
    const obstacle = cinemaNode('obstacle', 'shot', 0, 370, 400, 120);
    obstacle.data.locked = true;
    nodes.push(next, obstacle);
    edges.push(hierarchyEdge('scene-shot-02', 'scene-01', 'shot-02'));
    const result = planCinemaHierarchyLayout(nodes, edges, {
      parentId: 'scene-01', rootId: 'story-premise', insertionIndex: 1, newNodeId: 'shot-02',
    });
    expect(result.positions.has('obstacle')).toBe(false);
    const movedNext = { ...next, position: result.positions.get(next.id) ?? next.position };
    expect(rectanglesOverlap(nodeRectangle(movedNext), nodeRectangle(obstacle), 44)).toBe(false);
  });

  it('is deterministic and excludes hidden descendants until they are revealed', () => {
    const { nodes, edges } = structuredClone(initialDocument);
    const hiddenShot = cinemaNode('shot-02', 'shot', 0, 0, 360, 160);
    hiddenShot.hidden = true;
    nodes.push(hiddenShot);
    edges.push(hierarchyEdge('scene-shot-02', 'scene-01', 'shot-02'));

    const hiddenLayout = planCinemaHierarchyLayout(nodes, edges, { rootId: 'story-premise' });
    expect(hiddenLayout.positions.has('shot-02')).toBe(false);

    hiddenShot.hidden = false;
    const first = planCinemaHierarchyLayout(nodes, edges, { rootId: 'story-premise' });
    const second = planCinemaHierarchyLayout(nodes, edges, { rootId: 'story-premise' });
    expect([...second.positions]).toEqual([...first.positions]);
    expect(first.positions.has('shot-02')).toBe(true);
  });

  it('plans a ten-scene, one-hundred-shot hierarchy under 100ms', () => {
    const nodes: EditorNode[] = [cinemaNode('story', 'story', 40, 60, 240, 80)];
    const edges: EditorEdge[] = [];
    for (let sceneIndex = 0; sceneIndex < 10; sceneIndex += 1) {
      const sceneId = `scene-${sceneIndex}`;
      nodes.push(cinemaNode(sceneId, 'scene', 400 + sceneIndex * 20, 100, 230, 70 + sceneIndex * 3));
      edges.push(hierarchyEdge(`story-${sceneId}`, 'story', sceneId));
      for (let shotIndex = 0; shotIndex < 10; shotIndex += 1) {
        const shotId = `${sceneId}-shot-${shotIndex}`;
        nodes.push(cinemaNode(shotId, 'shot', 800 + shotIndex * 12, 400, 220 + shotIndex * 4, 68 + (shotIndex % 4) * 24));
        edges.push(hierarchyEdge(`${sceneId}-${shotId}`, sceneId, shotId));
      }
    }

    const startedAt = performance.now();
    const result = planCinemaHierarchyLayout(nodes, edges, { rootId: 'story' });
    const elapsed = performance.now() - startedAt;
    expect(result.hierarchyEdgeIds).toHaveLength(110);
    expect(result.positions.size).toBe(110);
    expect(elapsed).toBeLessThan(100);
  });
});
