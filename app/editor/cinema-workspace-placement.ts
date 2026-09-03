import type { CinemaProjectData } from '../domain/cinema/project-data';
import { cinemaDraftRole } from '../domain/cinema/manual-creation';
import { isCinemaHierarchyEdge, type CinemaHierarchyInsertion } from './cinema-hierarchy';
import {
  CONCEPT_BRANCH_GAP,
  CONCEPT_LEVEL_GAP,
  editorNodeDimensions,
  nodeRectangle,
  rectanglesOverlap,
  type NodePosition,
} from './node-layout';
import type { EditorEdge, EditorNode } from './types';

function role(node: EditorNode | undefined) {
  return node?.data.kind === 'concept'
    ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
    : null;
}

function acceptedHostIds(cinema: CinemaProjectData) {
  return new Set([
    ...(cinema.projectNodeId ? [cinema.projectNodeId] : []),
    ...Object.values(cinema.scenes).map((scene) => scene.nodeId),
    ...Object.values(cinema.shots).map((shot) => shot.nodeId),
    ...Object.values(cinema.characters).map((character) => character.nodeId),
    ...Object.values(cinema.assets).map((asset) => asset.nodeId),
    ...Object.values(cinema.agentRuns).map((run) => run.nodeId),
  ]);
}

function structuralDescendantIds(nodes: EditorNode[], edges: EditorEdge[], rootId: string) {
  const children = new Map<string, string[]>();
  for (const edge of edges.filter((candidate) => isCinemaHierarchyEdge(nodes, candidate))) {
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

function avoidVisibleCollisions(nodes: EditorNode[], newNode: EditorNode, desired: NodePosition) {
  let position = desired;
  const obstacles = nodes.filter((node) => node.id !== newNode.id && !node.hidden).map(nodeRectangle);
  for (let pass = 0; pass <= obstacles.length; pass += 1) {
    const candidate = { ...position, ...editorNodeDimensions(newNode) };
    const collisions = obstacles.filter((obstacle) => rectanglesOverlap(candidate, obstacle, CONCEPT_BRANCH_GAP));
    if (!collisions.length) return position;
    position = {
      ...position,
      y: Math.max(...collisions.map((collision) => collision.y + collision.height)) + CONCEPT_BRANCH_GAP,
    };
  }
  return position;
}

/**
 * Adds to a canvas containing an accepted horizontal cinema package without
 * invoking the generic top-down hierarchy reflow. Existing accepted hosts are
 * deliberately treated as fixed; only the new draft receives a position.
 */
export function planAcceptedCinemaDraftInsertion(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema: CinemaProjectData | undefined,
  insertion: CinemaHierarchyInsertion,
  newRole: 'scene' | 'shot',
  newNode: EditorNode,
): NodePosition | null {
  if (!cinema?.activeRevisionId || !cinema.projectNodeId || cinema.projectNodeId !== insertion.rootId) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parent = byId.get(insertion.parentId);
  if (!parent) return null;

  if (newRole === 'shot') {
    const manualShotIds = edges
      .filter((edge) => edge.source === parent.id && isCinemaHierarchyEdge(nodes, edge))
      .map((edge) => edge.target)
      .filter((id) => role(byId.get(id)) === 'shot');
    const localNodes = [parent, ...manualShotIds.map((id) => byId.get(id)).filter((node): node is EditorNode => Boolean(node))];
    const localBottom = Math.max(...localNodes.map((node) => node.position.y + editorNodeDimensions(node).height));
    return avoidVisibleCollisions(nodes, newNode, {
      x: parent.position.x,
      y: localBottom + CONCEPT_LEVEL_GAP,
    });
  }

  const projectIds = acceptedHostIds(cinema);
  for (const id of structuralDescendantIds(nodes, edges, insertion.rootId)) projectIds.add(id);
  const projectNodes = [...projectIds]
    .map((id) => byId.get(id))
    .filter((node): node is EditorNode => Boolean(node && !node.hidden));
  const projectBottom = Math.max(
    parent.position.y + editorNodeDimensions(parent).height,
    ...projectNodes.map((node) => node.position.y + editorNodeDimensions(node).height),
  );
  const selected = byId.get(insertion.selectedId);
  const existingScene = projectNodes.find((node) => role(node) === 'scene');
  const root = byId.get(insertion.rootId);
  const sceneX = role(selected) === 'scene'
    ? selected!.position.x
    : existingScene?.position.x
      ?? ((root?.position.x ?? parent.position.x) + (root ? editorNodeDimensions(root).width : 0) + CONCEPT_BRANCH_GAP);
  return avoidVisibleCollisions(nodes, newNode, {
    x: sceneX,
    y: projectBottom + CONCEPT_LEVEL_GAP,
  });
}
