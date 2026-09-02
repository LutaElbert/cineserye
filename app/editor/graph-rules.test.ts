import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  canConnect,
  collapsedDescendantIds,
  connectionIssue,
  graphIntegrityIssues,
  removeNodesAndConnections,
  tidyGraphPositions,
} from './graph-rules';
import { nodeRectangle, rectanglesOverlap } from './node-layout';
import type { EditorEdge, EditorNode } from './types';

function fixture() {
  return structuredClone(initialDocument);
}

function edge(id: string, source: string, target: string): EditorEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    data: { label: '', kind: 'default' },
  };
}

describe('connection rules', () => {
  it('accepts a new directed connection and permits its reverse', () => {
    const document = fixture();
    expect(canConnect(document.nodes, document.edges, { source: 'story-premise', target: 'shot-01' })).toBe(true);
    expect(canConnect(document.nodes, document.edges, { source: 'scene-01', target: 'story-premise' })).toBe(true);
  });

  it('rejects missing, unknown, and self endpoints', () => {
    const document = fixture();
    expect(connectionIssue(document.nodes, document.edges, { source: null, target: 'shot-01' })).toBe('missing-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'unknown', target: 'shot-01' })).toBe('unknown-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'story-premise', target: 'story-premise' })).toBe('self-connection');
  });

  it('rejects duplicate directed connections regardless of handles', () => {
    const document = fixture();
    expect(connectionIssue(document.nodes, document.edges, {
      source: 'story-premise',
      target: 'scene-01',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })).toBe('duplicate-connection');
  });

  it('rejects connections when either endpoint is locked', () => {
    const document = fixture();
    document.nodes[1].data.locked = true;
    expect(connectionIssue(document.nodes, document.edges, { source: 'scene-01', target: 'story-premise' })).toBe('locked-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'shot-01', target: 'scene-01' })).toBe('locked-endpoint');
  });

  it('ignores the edge being reconnected when checking duplicates', () => {
    const document = fixture();
    expect(canConnect(
      document.nodes,
      document.edges,
      { source: 'story-premise', target: 'scene-01' },
      'story-premise-scene-01',
    )).toBe(true);
  });
});

describe('graph integrity', () => {
  it('reports duplicate ids, missing endpoints, self-links, and duplicate pairs', () => {
    const document = fixture();
    const nodes = [...document.nodes, structuredClone(document.nodes[0])];
    const edges = [
      ...document.edges,
      edge('story-premise-scene-01', 'scene-01', 'shot-01'),
      edge('orphan', 'scene-01', 'missing'),
      edge('self', 'shot-01', 'shot-01'),
      edge('duplicate-pair', 'scene-01', 'shot-01'),
    ];
    expect(graphIntegrityIssues(nodes, edges).map((issue) => issue.kind)).toEqual(expect.arrayContaining([
      'duplicate-layer-id',
      'duplicate-connector-id',
      'missing-endpoint',
      'self-connection',
      'duplicate-connection',
    ]));
  });

  it('deletes incident connectors with selected layers', () => {
    const document = fixture();
    const result = removeNodesAndConnections(document.nodes, document.edges, new Set(['story-premise']));
    expect(result.nodes.map((node) => node.id)).toEqual(['scene-01', 'shot-01']);
    expect(result.edges.map((edge) => edge.id)).toEqual(['scene-01-shot-01']);
  });

  it('finds collapsed descendants without looping on cycles', () => {
    const document = fixture();
    const premise = document.nodes.find((node) => node.id === 'story-premise') as EditorNode;
    if (premise.data.kind !== 'concept') throw new Error('Expected a concept fixture.');
    premise.data.collapsed = true;
    document.edges.push(edge('cycle', 'shot-01', 'story-premise'));
    expect(collapsedDescendantIds(document.nodes, document.edges)).toEqual(new Set(['scene-01', 'shot-01']));
  });

  it('creates deterministic positions for rooted, cyclic, and disconnected graphs', () => {
    const document = fixture();
    document.edges.push(edge('cycle', 'shot-01', 'story-premise'));
    const disconnected = structuredClone(document.nodes[0]);
    disconnected.id = 'disconnected';
    disconnected.data.name = 'Disconnected';
    document.nodes.push(disconnected);
    const positions = tidyGraphPositions(document.nodes, document.edges);
    expect(positions.size).toBe(4);
    expect([...positions.values()].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(tidyGraphPositions(document.nodes, document.edges)).toEqual(positions);
  });

  it('excludes hidden layers from tidy positions', () => {
    const document = fixture();
    document.nodes[1].hidden = true;
    expect(tidyGraphPositions(document.nodes, document.edges).has('scene-01')).toBe(false);
  });

  it('packs mixed-height siblings without overlap', () => {
    const document = fixture();
    document.nodes[1].style = { width: 250, height: 190 };
    const sibling = structuredClone(document.nodes[1]);
    sibling.id = 'scene-sibling';
    sibling.style = { width: 250, height: 86 };
    document.nodes.push(sibling);
    document.edges.push(edge('story-sibling', 'story-premise', sibling.id));
    const positions = tidyGraphPositions(document.nodes, document.edges);
    const scene = { ...document.nodes[1], position: positions.get('scene-01')! };
    const next = { ...sibling, position: positions.get(sibling.id)! };

    expect(rectanglesOverlap(nodeRectangle(scene), nodeRectangle(next), 24)).toBe(false);
  });

  it('keeps locked nodes fixed and places movable siblings around them', () => {
    const document = fixture();
    const scene = document.nodes[1];
    scene.data.locked = true;
    scene.position = { x: 420, y: 90 };
    scene.style = { width: 250, height: 180 };
    const sibling = structuredClone(scene);
    sibling.id = 'movable-sibling';
    sibling.data.locked = false;
    sibling.style = { width: 250, height: 90 };
    document.nodes.push(sibling);
    document.edges.push(edge('story-movable-sibling', 'story-premise', sibling.id));
    const positions = tidyGraphPositions(document.nodes, document.edges);
    const moved = { ...sibling, position: positions.get(sibling.id)! };

    expect(positions.get(scene.id)).toEqual(scene.position);
    expect(rectanglesOverlap(nodeRectangle(scene), nodeRectangle(moved), 24)).toBe(false);
  });
});
