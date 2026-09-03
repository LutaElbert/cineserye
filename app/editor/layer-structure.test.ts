import { describe, expect, it } from 'vitest';
import { conceptTitleFromPlainText } from './rich-text';
import { buildLayerStructure } from './layer-structure';
import type { EditorEdge, EditorNode } from './types';

function concept(id: string, role: string, name = id): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    data: {
      kind: 'concept', domainType: `cinema.${role}`, name, label: name,
      title: conceptTitleFromPlainText(name), body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: role, tone: role === 'shot' ? 'mint' : role === 'story' ? 'indigo' : 'ink',
      collapsed: false, horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function edge(id: string, source: string, target: string, relationship?: 'hierarchy' | 'attachment' | 'reference'): EditorEdge {
  return { id, source, target, data: { label: '', kind: 'default', ...(relationship ? { relationship } : {}) } };
}

describe('manual layer structure projection', () => {
  it('projects and naturally sorts the Story, Scenes, Shots, and attachments', () => {
    const nodes = [
      concept('story', 'story', 'Story Premise'),
      concept('scene-10', 'scene', 'Scene 10'),
      concept('shot-10', 'shot', 'Shot 10'),
      concept('scene-2', 'scene', 'Scene 02'),
      concept('shot-2', 'shot', 'Shot 02'),
      concept('note', 'note', 'Wardrobe note'),
    ];
    const edges = [
      edge('e1', 'story', 'scene-10', 'hierarchy'),
      edge('e2', 'scene-10', 'shot-10', 'hierarchy'),
      edge('e3', 'story', 'scene-2', 'hierarchy'),
      edge('e4', 'scene-2', 'shot-2', 'hierarchy'),
      edge('e5', 'scene-2', 'note', 'attachment'),
    ];

    expect(buildLayerStructure(nodes, edges).rows.map(({ nodeId, depth, section }) => ({ nodeId, depth, section }))).toEqual([
      { nodeId: 'story', depth: 1, section: 'structure' },
      { nodeId: 'scene-2', depth: 2, section: 'structure' },
      { nodeId: 'shot-2', depth: 3, section: 'structure' },
      { nodeId: 'note', depth: 3, section: 'structure' },
      { nodeId: 'scene-10', depth: 2, section: 'structure' },
      { nodeId: 'shot-10', depth: 3, section: 'structure' },
    ]);
  });

  it('infers one safe legacy attachment but ignores reference edges', () => {
    const nodes = [concept('story', 'story'), concept('note', 'note')];
    expect(buildLayerStructure(nodes, [edge('legacy', 'story', 'note')]).rows[1]).toMatchObject({
      nodeId: 'note', parentId: 'story', depth: 2, section: 'structure',
    });
    expect(buildLayerStructure(nodes, [edge('reference', 'story', 'note', 'reference')]).rows[1]).toMatchObject({
      nodeId: 'note', parentId: null, section: 'unassigned',
    });
  });

  it('keeps multiply-parented and cyclic items reachable under Unassigned', () => {
    const nodes = [
      concept('story', 'story'), concept('scene', 'scene'), concept('note', 'note'), concept('other', 'note'),
    ];
    const result = buildLayerStructure(nodes, [
      edge('story-scene', 'story', 'scene', 'hierarchy'),
      edge('note-a', 'scene', 'note', 'attachment'),
      edge('note-b', 'story', 'note', 'attachment'),
      edge('cycle-a', 'note', 'other', 'attachment'),
      edge('cycle-b', 'other', 'note', 'attachment'),
    ]);
    expect(result.rows.find((row) => row.nodeId === 'note')).toMatchObject({ section: 'unassigned', warning: 'multiple-parents' });
    expect(result.rows.find((row) => row.nodeId === 'other')).toMatchObject({ section: 'unassigned' });

    const cycleOnly = buildLayerStructure(
      [concept('a', 'note'), concept('b', 'note')],
      [edge('a-b', 'a', 'b', 'attachment'), edge('b-a', 'b', 'a', 'attachment')],
    );
    expect(cycleOnly.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'a', section: 'unassigned', warning: 'cycle' }),
      expect.objectContaining({ nodeId: 'b', section: 'unassigned', warning: 'cycle' }),
    ]));
  });

  it('keeps ancestor context during search and restores collapse filtering outside search', () => {
    const nodes = [concept('story', 'story'), concept('scene', 'scene'), concept('shot', 'shot', 'Shot 06')];
    const edges = [edge('story-scene', 'story', 'scene', 'hierarchy'), edge('scene-shot', 'scene', 'shot', 'hierarchy')];
    expect(buildLayerStructure(nodes, edges, '', new Set(['scene'])).rows.map((row) => row.nodeId)).toEqual(['story', 'scene']);
    expect(buildLayerStructure(nodes, edges, 'shot 06', new Set(['scene'])).rows.map((row) => row.nodeId)).toEqual(['story', 'scene', 'shot']);
    expect(buildLayerStructure(nodes, edges, 'shot 06').matchCount).toBe(1);
  });

  it('projects five hundred nodes within the outline budget', () => {
    const nodes = [concept('story', 'story')];
    const edges: EditorEdge[] = [];
    for (let sceneIndex = 0; sceneIndex < 10; sceneIndex += 1) {
      const sceneId = `scene-${sceneIndex}`;
      nodes.push(concept(sceneId, 'scene', `Scene ${sceneIndex + 1}`));
      edges.push(edge(`story-${sceneId}`, 'story', sceneId, 'hierarchy'));
      for (let shotIndex = 0; shotIndex < 49; shotIndex += 1) {
        const shotId = `${sceneId}-shot-${shotIndex}`;
        nodes.push(concept(shotId, 'shot', `Shot ${shotIndex + 1}`));
        edges.push(edge(`${sceneId}-${shotId}`, sceneId, shotId, 'hierarchy'));
      }
    }
    const startedAt = performance.now();
    const result = buildLayerStructure(nodes, edges);
    expect(result.totalCount).toBe(501);
    expect(result.rows).toHaveLength(501);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
