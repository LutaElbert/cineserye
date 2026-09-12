import { cinemaDraftRole, type CinemaDraftRole } from '../domain/cinema/manual-creation';
import {
  CONCEPT_BRANCH_GAP,
  CONCEPT_LEVEL_GAP,
  editorNodeDimensions,
  nodeRectangle,
  rectanglesOverlap,
  type NodePosition,
} from './node-layout';
import type { EditorEdge, EditorNode } from './types';

type HierarchyRole = 'story' | 'scene' | 'shot';

export type CinemaHierarchyInsertion = {
  selectedId: string;
  selectedRole: HierarchyRole;
  parentId: string;
  rootId: string;
  insertionIndex: number;
};

export type CinemaHierarchyLayout = {
  positions: Map<string, NodePosition>;
  hierarchyEdgeIds: string[];
};

function nodeRole(node: EditorNode | undefined): CinemaDraftRole | null {
  return node?.data.kind === 'concept'
    ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
    : null;
}

function validHierarchyPair(sourceRole: CinemaDraftRole | null, targetRole: CinemaDraftRole | null) {
  return (sourceRole === 'story' && targetRole === 'scene')
    || (sourceRole === 'scene' && targetRole === 'shot');
}

export function isCinemaHierarchyEdge(nodes: EditorNode[], edge: EditorEdge): boolean {
  return isCinemaHierarchyEdgeInIndex(new Map(nodes.map((node) => [node.id, node])), edge);
}

/** Reuse one current-document index when classifying a batch of edges. Never
 * cache this across edits: node roles and missing endpoints may change. */
export function isCinemaHierarchyEdgeInIndex(byId: ReadonlyMap<string, EditorNode>, edge: EditorEdge): boolean {
  const validPair = validHierarchyPair(nodeRole(byId.get(edge.source)), nodeRole(byId.get(edge.target)));
  if (edge.data?.relationship !== undefined) return edge.data.relationship === 'hierarchy' && validPair;
  return validPair;
}

function hierarchyEdges(nodes: EditorNode[], edges: EditorEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => isCinemaHierarchyEdgeInIndex(byId, edge));
}

function orderedChildren(nodes: EditorNode[], edges: EditorEdge[], parentId: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return hierarchyEdges(nodes, edges)
    .filter((edge) => edge.source === parentId)
    .map((edge) => byId.get(edge.target))
    .filter((node): node is EditorNode => Boolean(node))
    .sort((left, right) => (
      left.position.x - right.position.x
      || left.position.y - right.position.y
      || left.id.localeCompare(right.id)
    ));
}

export function cinemaHierarchyParentId(
  nodes: EditorNode[],
  edges: EditorEdge[],
  nodeId: string,
  expectedRole: HierarchyRole,
): string | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const candidates = hierarchyEdges(nodes, edges)
    .filter((edge) => edge.target === nodeId && nodeRole(byId.get(edge.source)) === expectedRole)
    .map((edge) => edge.source);
  const unique = [...new Set(candidates)];
  if (unique.length > 1) throw new Error(`This layer has multiple ${expectedRole} parents. Resolve its hierarchy before adding another layer.`);
  return unique[0] ?? null;
}

export function cinemaHierarchyRootId(
  nodes: EditorNode[],
  edges: EditorEdge[],
  nodeId: string,
): string | null {
  const role = nodeRole(nodes.find((node) => node.id === nodeId));
  if (role === 'story') return nodeId;
  if (role === 'scene') return cinemaHierarchyParentId(nodes, edges, nodeId, 'story') ?? nodeId;
  if (role === 'shot') {
    const sceneId = cinemaHierarchyParentId(nodes, edges, nodeId, 'scene');
    if (!sceneId) return null;
    return cinemaHierarchyParentId(nodes, edges, sceneId, 'story') ?? sceneId;
  }
  return null;
}

export function resolveCinemaHierarchyInsertion(
  nodes: EditorNode[],
  edges: EditorEdge[],
  selectedId: string,
  newRole: 'scene' | 'shot',
): CinemaHierarchyInsertion {
  const selected = nodes.find((node) => node.id === selectedId);
  const selectedRole = nodeRole(selected);
  if (selectedRole !== 'story' && selectedRole !== 'scene' && selectedRole !== 'shot') {
    throw new Error('Choose a Story, Scene, or Shot before adding this filmmaking layer.');
  }

  let parentId: string | null = null;
  let rootId: string | null = null;
  let insertionIndex = 0;
  if (newRole === 'scene') {
    if (selectedRole === 'story') {
      parentId = selectedId;
      rootId = selectedId;
      insertionIndex = orderedChildren(nodes, edges, parentId).length;
    } else if (selectedRole === 'scene') {
      parentId = cinemaHierarchyParentId(nodes, edges, selectedId, 'story');
      if (!parentId) throw new Error('This scene has no Story parent. Connect it to a Story before adding the next scene.');
      rootId = parentId;
      const siblings = orderedChildren(nodes, edges, parentId);
      insertionIndex = siblings.findIndex((node) => node.id === selectedId) + 1;
    } else {
      throw new Error('Add the next scene from a Story or Scene layer.');
    }
  } else if (selectedRole === 'scene') {
    parentId = selectedId;
    rootId = cinemaHierarchyParentId(nodes, edges, selectedId, 'story') ?? selectedId;
    insertionIndex = orderedChildren(nodes, edges, parentId).length;
  } else if (selectedRole === 'shot') {
    parentId = cinemaHierarchyParentId(nodes, edges, selectedId, 'scene');
    if (!parentId) throw new Error('This shot has no Scene parent. Connect it to a Scene before adding the next shot.');
    rootId = cinemaHierarchyParentId(nodes, edges, parentId, 'story') ?? parentId;
    const siblings = orderedChildren(nodes, edges, parentId);
    insertionIndex = siblings.findIndex((node) => node.id === selectedId) + 1;
  } else {
    throw new Error('Add a shot from a Scene or Shot layer.');
  }

  return { selectedId, selectedRole, parentId, rootId, insertionIndex };
}

function descendantIds(children: Map<string, string[]>, rootId: string) {
  const result = new Set<string>();
  const visit = (id: string, lineage: Set<string>) => {
    if (lineage.has(id)) throw new Error('The cinema hierarchy contains a cycle.');
    result.add(id);
    const nextLineage = new Set(lineage).add(id);
    for (const childId of children.get(id) ?? []) visit(childId, nextLineage);
  };
  visit(rootId, new Set());
  return result;
}

export function planCinemaHierarchyLayout(
  nodes: EditorNode[],
  edges: EditorEdge[],
  insertion: Pick<CinemaHierarchyInsertion, 'rootId'>
    & Partial<Pick<CinemaHierarchyInsertion, 'parentId' | 'insertionIndex'>>
    & { newNodeId?: string },
): CinemaHierarchyLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(insertion.rootId);
  if (!root) throw new Error('The cinema hierarchy root is missing.');
  const structuralEdges = hierarchyEdges(nodes, edges);
  const parentCounts = new Map<string, number>();
  for (const edge of structuralEdges) parentCounts.set(edge.target, (parentCounts.get(edge.target) ?? 0) + 1);
  if ([...parentCounts.values()].some((count) => count > 1)) {
    throw new Error('The cinema hierarchy contains a layer with multiple parents.');
  }
  const children = new Map<string, string[]>();
  for (const edge of structuralEdges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  for (const [parentId, childIds] of children) {
    const ordered = childIds
      .map((id) => byId.get(id))
      .filter((node): node is EditorNode => Boolean(node))
      .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y || left.id.localeCompare(right.id))
      .map((node) => node.id);
    if (
      insertion.newNodeId !== undefined
      && insertion.insertionIndex !== undefined
      && parentId === insertion.parentId
    ) {
      const withoutNew = ordered.filter((id) => id !== insertion.newNodeId);
      withoutNew.splice(Math.min(insertion.insertionIndex, withoutNew.length), 0, insertion.newNodeId);
      children.set(parentId, withoutNew);
    } else {
      children.set(parentId, ordered);
    }
  }

  const affectedIds = descendantIds(children, insertion.rootId);
  const visibleIds = new Set([...affectedIds].filter((id) => !byId.get(id)?.hidden));
  const depths = new Map<string, number>();
  const visitDepth = (id: string, depth: number) => {
    if (!visibleIds.has(id)) return;
    depths.set(id, depth);
    for (const childId of children.get(id) ?? []) visitDepth(childId, depth + 1);
  };
  visitDepth(insertion.rootId, 0);

  const levelHeights = new Map<number, number>();
  for (const [id, depth] of depths) {
    const node = byId.get(id)!;
    levelHeights.set(depth, Math.max(levelHeights.get(depth) ?? 0, editorNodeDimensions(node).height));
  }
  const levelY = new Map<number, number>([[0, root.position.y]]);
  for (let depth = 1; depth <= Math.max(0, ...depths.values()); depth += 1) {
    levelY.set(depth, (levelY.get(depth - 1) ?? root.position.y) + (levelHeights.get(depth - 1) ?? 0) + CONCEPT_LEVEL_GAP);
  }

  const widths = new Map<string, number>();
  const subtreeWidth = (id: string, lineage: Set<string>): number => {
    if (lineage.has(id)) throw new Error('The cinema hierarchy contains a cycle.');
    const cached = widths.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node || node.hidden) return 0;
    const childWidths = (children.get(id) ?? []).map((childId) => subtreeWidth(childId, new Set(lineage).add(id))).filter((width) => width > 0);
    const descendantsWidth = childWidths.reduce((sum, width) => sum + width, 0)
      + Math.max(0, childWidths.length - 1) * CONCEPT_BRANCH_GAP;
    const width = Math.max(editorNodeDimensions(node).width, descendantsWidth);
    widths.set(id, width);
    return width;
  };

  const rootWidth = subtreeWidth(insertion.rootId, new Set());
  const desired = new Map<string, NodePosition>();
  const place = (id: string, left: number) => {
    const node = byId.get(id);
    if (!node || node.hidden) return;
    const width = widths.get(id) ?? editorNodeDimensions(node).width;
    const dimensions = editorNodeDimensions(node);
    const depth = depths.get(id) ?? 0;
    desired.set(id, {
      x: left + (width - dimensions.width) / 2,
      y: levelY.get(depth) ?? node.position.y,
    });
    const visibleChildren = (children.get(id) ?? []).filter((childId) => visibleIds.has(childId));
    const total = visibleChildren.reduce((sum, childId) => sum + (widths.get(childId) ?? 0), 0)
      + Math.max(0, visibleChildren.length - 1) * CONCEPT_BRANCH_GAP;
    let childLeft = left + (width - total) / 2;
    for (const childId of visibleChildren) {
      place(childId, childLeft);
      childLeft += (widths.get(childId) ?? 0) + CONCEPT_BRANCH_GAP;
    }
  };
  const rootDimensions = editorNodeDimensions(root);
  place(insertion.rootId, root.position.x + rootDimensions.width / 2 - rootWidth / 2);
  desired.set(insertion.rootId, { ...root.position });

  const descendantsById = new Map<string, Set<string>>();
  for (const id of affectedIds) descendantsById.set(id, descendantIds(children, id));
  const fixedRectangles = nodes
    .filter((node) => !node.hidden && (!affectedIds.has(node.id) || node.data.locked || node.id === insertion.rootId))
    .map(nodeRectangle);
  const placedRectangles = [...fixedRectangles];
  const orderedMovable = [...desired.entries()]
    .filter(([id]) => id !== insertion.rootId && !byId.get(id)?.data.locked)
    .sort(([leftId, left], [rightId, right]) => (
      (depths.get(leftId) ?? 0) - (depths.get(rightId) ?? 0) || left.x - right.x || leftId.localeCompare(rightId)
    ));
  for (const [id] of orderedMovable) {
    const node = byId.get(id)!;
    let position = desired.get(id)!;
    let candidate = { ...position, ...editorNodeDimensions(node) };
    for (let pass = 0; pass <= placedRectangles.length; pass += 1) {
      const collisions = placedRectangles.filter((rectangle) => rectanglesOverlap(candidate, rectangle, CONCEPT_BRANCH_GAP));
      if (!collisions.length) break;
      const nextX = Math.max(...collisions.map((rectangle) => rectangle.x + rectangle.width + CONCEPT_BRANCH_GAP));
      const delta = nextX - position.x;
      for (const descendantId of descendantsById.get(id) ?? []) {
        const descendantPosition = desired.get(descendantId);
        if (descendantPosition && !byId.get(descendantId)?.data.locked) {
          desired.set(descendantId, { ...descendantPosition, x: descendantPosition.x + delta });
        }
      }
      position = desired.get(id)!;
      candidate = { ...position, ...editorNodeDimensions(node) };
    }
    placedRectangles.push(candidate);
  }

  const positions = new Map<string, NodePosition>();
  for (const [id, position] of desired) {
    const node = byId.get(id);
    if (!node || node.data.locked || id === insertion.rootId) continue;
    if (position.x !== node.position.x || position.y !== node.position.y) positions.set(id, position);
  }
  return {
    positions,
    hierarchyEdgeIds: structuralEdges
      .filter((edge) => affectedIds.has(edge.source) && affectedIds.has(edge.target))
      .map((edge) => edge.id),
  };
}
