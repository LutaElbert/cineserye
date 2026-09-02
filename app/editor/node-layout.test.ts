import { describe, expect, it } from 'vitest';
import {
  nodeRectangle,
  rectanglesOverlap,
  relativeConceptLayout,
  verticalNodeLane,
} from './node-layout';
import { conceptTitleFromPlainText } from './rich-text';
import type { EditorEdge, EditorNode } from './types';

function concept(id: string, x: number, y: number, width = 220, height = 68): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x, y },
    style: { width, height },
    data: {
      kind: 'concept',
      name: id,
      label: id,
      title: conceptTitleFromPlainText(id),
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: 'Concept',
      tone: 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

function raster(id: string, x: number, y: number, width = 320, height = 240): EditorNode {
  return {
    id,
    type: 'raster',
    position: { x, y },
    style: { width, height },
    data: {
      kind: 'raster',
      name: id,
      src: 'data:image/png;base64,',
      fileName: `${id}.png`,
      naturalWidth: width,
      naturalHeight: height,
      opacity: 1,
      locked: false,
    },
  };
}

function edge(source: string, target: string): EditorEdge {
  return { id: `${source}-${target}`, source, target, data: { label: '', kind: 'default' } };
}

describe('relativeConceptLayout', () => {
  it('centers a first child beneath its parent', () => {
    const result = relativeConceptLayout([concept('parent', 100, 80)], [], 'parent', 'child', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('new')).toEqual({ x: 100, y: 240 });
  });

  it('distributes children by their measured widths without overlap', () => {
    const nodes = [concept('parent', 100, 80), concept('first', 100, 240, 180)];
    const result = relativeConceptLayout(nodes, [edge('parent', 'first')], 'parent', 'child', 'new');
    const first = result.positions.get('first')!;
    const next = result.positions.get('new')!;
    expect(next.x - (first.x + 180)).toBe(44);
    expect(first.y).toBe(next.y);
    expect(first.x + (180 + 44 + 220) / 2).toBe(210);
  });

  it('inserts a sibling after the selected child', () => {
    const nodes = [
      concept('parent', 100, 80),
      concept('first', 0, 240),
      concept('second', 264, 240),
    ];
    const edges = [edge('parent', 'first'), edge('parent', 'second')];
    const result = relativeConceptLayout(nodes, edges, 'first', 'sibling', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('first')!.x).toBeLessThan(result.positions.get('new')!.x);
    expect(result.positions.get('new')!.x).toBeLessThan(result.positions.get('second')!.x);
  });

  it('places an unconnected root sibling beside the selected concept', () => {
    const result = relativeConceptLayout([concept('root', 50, 70)], [], 'root', 'sibling', 'new');
    expect(result.parentId).toBeNull();
    expect(result.positions.get('new')).toEqual({ x: 314, y: 70 });
  });

  it('centers a concept child beneath an image using the image height', () => {
    const result = relativeConceptLayout([raster('image', 40, 60)], [], 'image', 'child', 'new');
    expect(result.parentId).toBe('image');
    expect(result.positions.get('new')).toEqual({ x: 90, y: 392 });
  });

  it('places an unconnected image sibling beside the image without a parent', () => {
    const result = relativeConceptLayout([raster('image', 40, 60)], [], 'image', 'sibling', 'new');
    expect(result.parentId).toBeNull();
    expect(result.positions.get('new')).toEqual({ x: 404, y: 60 });
  });

  it('places an image sibling in its existing parent row', () => {
    const nodes = [concept('parent', 100, 80), raster('image', 0, 240, 320, 180)];
    const result = relativeConceptLayout(nodes, [edge('parent', 'image')], 'image', 'sibling', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('image')).toEqual({ x: -82, y: 240 });
    expect(result.positions.get('new')).toEqual({ x: 282, y: 240 });
  });
});

describe('dimension-aware canvas layout', () => {
  it('packs mixed-height nodes vertically with a stable gap', () => {
    const nodes = [
      concept('short', 0, 0, 250, 88),
      concept('long', 0, 0, 250, 164),
      concept('final', 0, 0, 250, 104),
    ];
    const lane = verticalNodeLane(nodes, ['short', 'long', 'final'], 740, 20);

    expect(lane.positions.get('short')).toEqual({ x: 740, y: 20 });
    expect(lane.positions.get('long')).toEqual({ x: 740, y: 132 });
    expect(lane.positions.get('final')).toEqual({ x: 740, y: 320 });
    expect(lane.height).toBe(404);
  });

  it('uses measured content height and detects intersecting rectangles', () => {
    const first = concept('first', 10, 20, 220, 68);
    first.measured = { width: 250, height: 140 };
    const second = concept('second', 10, 150, 220, 68);
    const separated = concept('separated', 10, 185, 220, 68);

    expect(nodeRectangle(first)).toEqual({ x: 10, y: 20, width: 220, height: 140 });
    expect(rectanglesOverlap(nodeRectangle(first), nodeRectangle(second))).toBe(true);
    expect(rectanglesOverlap(nodeRectangle(first), nodeRectangle(separated), 24)).toBe(false);
  });
});
