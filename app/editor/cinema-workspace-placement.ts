import type { CinemaProjectData } from '../domain/cinema/project-data';
import { cinemaDraftRole, type CinemaDraftRole } from '../domain/cinema/manual-creation';
import type { CinemaHierarchyInsertion } from './cinema-hierarchy';
import {
  CONCEPT_BRANCH_GAP,
  CONCEPT_LEVEL_GAP,
  editorNodeDimensions,
  nodeRectangle,
  rectanglesOverlap,
  type NodePosition,
} from './node-layout';
import type { EditorEdge, EditorNode } from './types';

export type CinemaConnectionDirection = 'horizontal' | 'vertical';

export type CinemaDraftPlacement = {
  position: NodePosition;
  positions: Map<string, NodePosition>;
  direction: CinemaConnectionDirection;
  sourceHandle?: 'bottom';
  targetHandle?: 'top';
};

function role(node: EditorNode | undefined) {
  return node?.data.kind === 'concept'
    ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
    : null;
}

function isSemanticParentEdge(edge: EditorEdge) {
  const relationship = edge.data?.relationship;
  return relationship !== 'reference' && relationship !== 'sequence';
}

function isStructuralEdge(edge: EditorEdge) {
  return edge.data?.relationship === 'hierarchy' || edge.data?.relationship === 'attachment';
}

function cinemaHostIds(cinema: CinemaProjectData | undefined) {
  if (!cinema?.activeRevisionId) return new Set<string>();
  return new Set([
    ...(cinema.projectNodeId ? [cinema.projectNodeId] : []),
    ...Object.values(cinema.scenes).map((scene) => scene.nodeId),
    ...Object.values(cinema.shots).map((shot) => shot.nodeId),
    ...Object.values(cinema.characters).map((character) => character.nodeId),
    ...Object.values(cinema.assets).map((asset) => asset.nodeId),
    ...Object.values(cinema.agentRuns).map((run) => run.nodeId),
  ]);
}

function semanticDescendantIds(edges: EditorEdge[], rootId: string) {
  const children = new Map<string, string[]>();
  for (const edge of edges.filter(isStructuralEdge)) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const result = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const current = pending.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return result;
}

function positionedRectangle(node: EditorNode, positions: Map<string, NodePosition>) {
  return { ...(positions.get(node.id) ?? node.position), ...editorNodeDimensions(node) };
}

function branchBounds(
  nodes: EditorNode[],
  edges: EditorEdge[],
  rootId: string,
  positions: Map<string, NodePosition>,
) {
  const descendants = semanticDescendantIds(edges, rootId);
  const rectangles = nodes
    .filter((node) => descendants.has(node.id) && !node.hidden)
    .map((node) => positionedRectangle(node, positions));
  if (!rectangles.length) return null;
  return {
    top: Math.min(...rectangles.map((rectangle) => rectangle.y)),
    bottom: Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height)),
  };
}

function edgeDirection(edge: EditorEdge | undefined): CinemaConnectionDirection {
  return edge?.sourceHandle === 'bottom' && edge.targetHandle === 'top'
    ? 'vertical'
    : 'horizontal';
}

function directRoleChildren(
  nodes: EditorNode[],
  edges: EditorEdge[],
  parentId: string,
  expectedRole: CinemaDraftRole,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.source === parentId && isSemanticParentEdge(edge))
    .map((edge) => byId.get(edge.target))
    .filter((node): node is EditorNode => Boolean(node && role(node) === expectedRole));
}

function cinemaRoleNodeIds(
  cinema: CinemaProjectData | undefined,
  parentId: string,
  expectedRole: CinemaDraftRole,
) {
  if (!cinema) return [];
  if (expectedRole === 'scene') return Object.values(cinema.scenes).map((scene) => scene.nodeId);

  const scene = Object.values(cinema.scenes).find((candidate) => candidate.nodeId === parentId);
  if (!scene) return [];
  if (expectedRole === 'shot') {
    return scene.shotIds
      .map((shotId) => cinema.shots[shotId]?.nodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId));
  }
  if (expectedRole === 'character') {
    return Object.values(cinema.characters)
      .filter((character) => character.sceneIds.includes(scene.id))
      .map((character) => character.nodeId);
  }
  if (expectedRole === 'location' || expectedRole === 'prop' || expectedRole === 'visual-element') {
    return Object.values(cinema.assets)
      .filter((asset) => asset.category === expectedRole && asset.sceneIds.includes(scene.id))
      .map((asset) => asset.nodeId);
  }
  return [];
}

function roleLaneNodes(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema: CinemaProjectData | undefined,
  parentId: string,
  expectedRole: CinemaDraftRole,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const candidates = [
    ...directRoleChildren(nodes, edges, parentId, expectedRole),
    ...cinemaRoleNodeIds(cinema, parentId, expectedRole)
      .map((id) => byId.get(id))
      .filter((node): node is EditorNode => Boolean(node)),
  ];
  return [...new Map(candidates.map((node) => [node.id, node])).values()]
    .filter((node) => !node.hidden);
}

function inferDirection(
  nodes: EditorNode[],
  edges: EditorEdge[],
  parentId: string,
  expectedRole: CinemaDraftRole,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = edges.filter((edge) => edge.source === parentId && isSemanticParentEdge(edge));
  const sameRole = outgoing.find((edge) => role(byId.get(edge.target)) === expectedRole);
  return edgeDirection(sameRole ?? outgoing[0]);
}

function avoidVisibleCollisions(
  nodes: EditorNode[],
  newNode: EditorNode,
  desired: NodePosition,
  direction: CinemaConnectionDirection,
) {
  let position = desired;
  const obstacles = nodes.filter((node) => node.id !== newNode.id && !node.hidden).map(nodeRectangle);
  for (let pass = 0; pass <= obstacles.length; pass += 1) {
    const candidate = { ...position, ...editorNodeDimensions(newNode) };
    const collisions = obstacles.filter((obstacle) => rectanglesOverlap(candidate, obstacle, CONCEPT_BRANCH_GAP));
    if (!collisions.length) return position;
    position = direction === 'horizontal'
      ? {
        ...position,
        y: Math.max(...collisions.map((collision) => collision.y + collision.height)) + CONCEPT_BRANCH_GAP,
      }
      : {
        ...position,
        x: Math.max(...collisions.map((collision) => collision.x + collision.width)) + CONCEPT_BRANCH_GAP,
      };
  }
  return position;
}

/**
 * Places one new typed cinema node in its parent's established lane. Existing
 * nodes never move: the semantic parent and its connector direction are the
 * stable anchors, while the new node is appended on the lane's free axis.
 */
export function planCinemaDraftInsertion(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema: CinemaProjectData | undefined,
  insertion: Pick<CinemaHierarchyInsertion, 'parentId'>,
  newRole: CinemaDraftRole,
  newNode: EditorNode,
): CinemaDraftPlacement | null {
  const parent = nodes.find((node) => node.id === insertion.parentId);
  if (!parent) return null;

  const direction = inferDirection(nodes, edges, parent.id, newRole);
  const lane = roleLaneNodes(nodes, edges, cinema, parent.id, newRole);
  const parentSize = editorNodeDimensions(parent);
  let desired: NodePosition;

  if (direction === 'horizontal') {
    desired = lane.length
      ? {
        x: lane[0].position.x,
        y: newRole === 'scene'
          ? Math.max(...lane.map((node) => (
            branchBounds(nodes, edges, node.id, new Map())?.bottom
              ?? node.position.y + editorNodeDimensions(node).height
          ))) + CONCEPT_BRANCH_GAP
          : Math.max(...lane.map((node) => node.position.y + editorNodeDimensions(node).height))
            + CONCEPT_BRANCH_GAP,
      }
      : {
        x: parent.position.x + parentSize.width + CONCEPT_LEVEL_GAP,
        y: parent.position.y,
      };
  } else {
    desired = lane.length
      ? {
        x: Math.max(...lane.map((node) => node.position.x + editorNodeDimensions(node).width))
          + CONCEPT_BRANCH_GAP,
        y: lane[0].position.y,
      }
      : {
        x: parent.position.x,
        y: parent.position.y + parentSize.height + CONCEPT_LEVEL_GAP,
      };
  }

  const position = avoidVisibleCollisions(nodes, newNode, desired, direction);
  const positions = new Map<string, NodePosition>([[newNode.id, position]]);

  if (direction === 'horizontal' && role(parent) === 'scene') {
    const fixedIds = cinemaHostIds(cinema);
    const parentIsMovable = !parent.data.locked && !fixedIds.has(parent.id);
    const virtualNode = { ...newNode, position };
    const virtualEdge: EditorEdge = {
      id: `layout-${newNode.id}`,
      source: parent.id,
      target: newNode.id,
      data: { label: '', kind: 'default', relationship: 'attachment' },
    };
    const layoutNodes = [...nodes, virtualNode];
    const layoutEdges = [...edges, virtualEdge];
    const byId = new Map(layoutNodes.map((node) => [node.id, node]));
    const children = layoutEdges
      .filter((edge) => edge.source === parent.id && isStructuralEdge(edge))
      .map((edge) => byId.get(edge.target))
      .filter((node): node is EditorNode => Boolean(node && !node.hidden));

    if (parentIsMovable && children.length) {
      const childRectangles = children.map((child) => positionedRectangle(child, positions));
      const childTop = Math.min(...childRectangles.map((rectangle) => rectangle.y));
      const childBottom = Math.max(...childRectangles.map((rectangle) => rectangle.y + rectangle.height));
      const parentHeight = editorNodeDimensions(parent).height;
      positions.set(parent.id, {
        x: parent.position.x,
        y: childTop + (childBottom - childTop - parentHeight) / 2,
      });

      const storyEdge = edges.find((edge) => (
        edge.target === parent.id
        && isStructuralEdge(edge)
        && role(nodes.find((node) => node.id === edge.source)) === 'story'
      ));
      if (storyEdge) {
        const sceneIds = edges
          .filter((edge) => edge.source === storyEdge.source && isStructuralEdge(edge))
          .map((edge) => edge.target)
          .filter((id) => role(byId.get(id)) === 'scene');
        const currentIndex = sceneIds.indexOf(parent.id);
        let cursorBottom = branchBounds(layoutNodes, layoutEdges, parent.id, positions)?.bottom
          ?? positions.get(parent.id)!.y + parentHeight;
        for (const sceneId of sceneIds.slice(currentIndex + 1)) {
          const scene = byId.get(sceneId);
          if (!scene) continue;
          const bounds = branchBounds(layoutNodes, layoutEdges, sceneId, positions);
          if (!bounds) continue;
          const delta = Math.max(0, cursorBottom + CONCEPT_BRANCH_GAP - bounds.top);
          if (delta > 0 && !scene.data.locked && !fixedIds.has(scene.id)) {
            for (const descendantId of semanticDescendantIds(layoutEdges, scene.id)) {
              const descendant = byId.get(descendantId);
              if (!descendant || descendant.hidden || descendant.data.locked || fixedIds.has(descendant.id)) continue;
              const current = positions.get(descendant.id) ?? descendant.position;
              positions.set(descendant.id, { x: current.x, y: current.y + delta });
            }
          }
          cursorBottom = Math.max(
            cursorBottom,
            branchBounds(layoutNodes, layoutEdges, scene.id, positions)?.bottom ?? bounds.bottom,
          );
        }
      }
    }
  }

  const finalPosition = positions.get(newNode.id) ?? position;
  return direction === 'vertical'
    ? { position: finalPosition, positions, direction, sourceHandle: 'bottom', targetHandle: 'top' }
    : { position: finalPosition, positions, direction };
}
