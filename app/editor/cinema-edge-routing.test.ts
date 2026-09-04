import { describe, expect, it } from 'vitest';
import { conceptTitleFromPlainText } from './rich-text';
import { planCinemaHierarchyBusRoutes } from './cinema-edge-routing';
import type { EditorEdge, EditorNode } from './types';

function concept(
  id: string,
  role: 'story' | 'scene' | 'shot' | 'note',
  x: number,
  y: number,
  hidden = false,
): EditorNode {
  const name = `${role} ${id}`;
  return {
    id,
    type: 'concept',
    position: { x, y },
    style: { width: 220, height: 68 },
    hidden,
    data: {
      kind: 'concept',
      domainType: `cinema.${role}`,
      name,
      label: name,
      title: conceptTitleFromPlainText(name),
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: role,
      tone: role === 'story' ? 'indigo' : role === 'shot' ? 'mint' : 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  relationship: 'hierarchy' | 'attachment' | 'reference' | 'sequence' | undefined = 'hierarchy',
  vertical = false,
): EditorEdge {
  return {
    id,
    source,
    target,
    ...(vertical ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}),
    type: 'smoothstep',
    data: { label: '', kind: 'default', ...(relationship ? { relationship } : {}) },
  };
}

describe('connection-aware cinema hierarchy routing', () => {
  it('gives direct Story to Scene siblings one shared spine between their cards', () => {
    const nodes = [
      concept('story', 'story', 100, 200),
      concept('scene-01', 'scene', 500, 80),
      concept('scene-02', 'scene', 500, 200),
      concept('scene-03', 'scene', 500, 320),
    ];
    const edges = [
      edge('story-scene-03', 'story', 'scene-03'),
      edge('story-scene-01', 'story', 'scene-01'),
      edge('story-scene-02', 'story', 'scene-02'),
    ];

    const routes = planCinemaHierarchyBusRoutes(nodes, edges);
    expect([...routes.keys()].sort()).toEqual(['story-scene-01', 'story-scene-02', 'story-scene-03']);
    expect(new Set([...routes.values()].map((route) => route.trunkX))).toEqual(new Set([410]));
    expect(routes.get('story-scene-01')).toEqual({ kind: 'story-scene-bus', trunkX: 410 });
  });

  it('updates from visible siblings while keeping single-child and vertical layouts on default routing', () => {
    const story = concept('story', 'story', 100, 200);
    const scene01 = concept('scene-01', 'scene', 500, 80);
    const hiddenScene = concept('scene-02', 'scene', 500, 200, true);
    expect(planCinemaHierarchyBusRoutes(
      [story, scene01, hiddenScene],
      [edge('one', 'story', 'scene-01'), edge('hidden', 'story', 'scene-02')],
    ).size).toBe(0);

    const scene02 = { ...hiddenScene, hidden: false };
    expect(planCinemaHierarchyBusRoutes(
      [story, scene01, scene02],
      [edge('vertical-1', 'story', 'scene-01', 'hierarchy', true), edge('vertical-2', 'story', 'scene-02', 'hierarchy', true)],
    ).size).toBe(0);
  });

  it('supports legacy semantic hierarchy edges and ignores other relationship kinds', () => {
    const nodes = [
      concept('story', 'story', 100, 200),
      concept('scene-01', 'scene', 500, 80),
      concept('scene-02', 'scene', 500, 200),
      concept('shot-01', 'shot', 820, 80),
      concept('note-01', 'note', 500, 320),
    ];
    const routes = planCinemaHierarchyBusRoutes(nodes, [
      edge('legacy-1', 'story', 'scene-01', undefined),
      edge('legacy-2', 'story', 'scene-02', undefined),
      edge('attachment', 'story', 'note-01', 'attachment'),
      edge('reference', 'story', 'scene-01', 'reference'),
      edge('sequence', 'story', 'scene-02', 'sequence'),
      edge('scene-shot', 'scene-01', 'shot-01'),
    ]);

    expect([...routes.keys()].sort()).toEqual(['legacy-1', 'legacy-2']);
  });

  it('falls back when the shared spine cannot clear both hierarchy levels', () => {
    const nodes = [
      concept('story', 'story', 100, 200),
      concept('scene-01', 'scene', 350, 80),
      concept('scene-02', 'scene', 350, 200),
    ];
    expect(planCinemaHierarchyBusRoutes(nodes, [
      edge('one', 'story', 'scene-01'),
      edge('two', 'story', 'scene-02'),
    ]).size).toBe(0);
  });
});
