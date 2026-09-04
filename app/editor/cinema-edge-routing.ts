import { cinemaDraftRole } from '../domain/cinema/manual-creation';
import { isCinemaHierarchyEdge } from './cinema-hierarchy';
import { editorNodeDimensions } from './node-layout';
import type { EditorEdge, EditorNode } from './types';

export const CINEMA_HIERARCHY_BUS_EDGE_TYPE = 'cinema-hierarchy-bus';

export type CinemaHierarchyBusRoute = {
  kind: 'story-scene-bus';
  trunkX: number;
};

const MINIMUM_SPINE_CLEARANCE = 24;

function nodeRole(node: EditorNode | undefined) {
  return node?.data.kind === 'concept'
    ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
    : null;
}

function isHorizontalHierarchyEdge(edge: EditorEdge) {
  return edge.sourceHandle !== 'bottom' && edge.targetHandle !== 'top';
}

/**
 * Plans presentation-only routing for direct Story -> Scene sibling groups.
 * The returned metadata is deliberately not written to the project document.
 */
export function planCinemaHierarchyBusRoutes(
  nodes: EditorNode[],
  edges: EditorEdge[],
): Map<string, CinemaHierarchyBusRoute> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const eligibleEdges = edges.filter((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return Boolean(
      source
      && target
      && !source.hidden
      && !target.hidden
      && nodeRole(source) === 'story'
      && nodeRole(target) === 'scene'
      && isCinemaHierarchyEdge(nodes, edge)
      && isHorizontalHierarchyEdge(edge),
    );
  });

  const edgesByStory = new Map<string, EditorEdge[]>();
  for (const edge of eligibleEdges) {
    const siblings = edgesByStory.get(edge.source) ?? [];
    siblings.push(edge);
    edgesByStory.set(edge.source, siblings);
  }

  const routes = new Map<string, CinemaHierarchyBusRoute>();
  for (const [storyId, siblingEdges] of edgesByStory) {
    if (siblingEdges.length < 2) continue;
    const story = nodeById.get(storyId)!;
    const storyRight = story.position.x + editorNodeDimensions(story).width;
    const nearestSceneLeft = Math.min(...siblingEdges.map((edge) => nodeById.get(edge.target)!.position.x));
    if (nearestSceneLeft - storyRight < MINIMUM_SPINE_CLEARANCE * 2) continue;

    const trunkX = Math.round((storyRight + nearestSceneLeft) / 2);
    for (const edge of siblingEdges) routes.set(edge.id, { kind: 'story-scene-bus', trunkX });
  }
  return routes;
}
