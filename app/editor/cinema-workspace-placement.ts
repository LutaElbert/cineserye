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

export type CinemaWorkspaceLayout = {
  handled: boolean;
  positions: Map<string, NodePosition>;
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

function isStructuralEdge(nodes: EditorNode[], edge: EditorEdge) {
  if (edge.data?.relationship === 'hierarchy' || edge.data?.relationship === 'attachment') return true;
  if (edge.data?.relationship !== undefined) return false;
  const sourceRole = role(nodes.find((node) => node.id === edge.source));
  const targetRole = role(nodes.find((node) => node.id === edge.target));
  return (sourceRole === 'story' && targetRole === 'scene')
    || (sourceRole === 'scene' && targetRole !== null && targetRole !== 'story' && targetRole !== 'scene');
}

function cinemaHostIds(cinema: CinemaProjectData | undefined) {
  if (!cinema) return new Set<string>();
  const acceptedSceneIds = new Set(Object.values(cinema.revisions).map((revision) => revision.sceneId));
  if (!acceptedSceneIds.size) return new Set<string>();
  return new Set([
    ...(cinema.projectNodeId ? [cinema.projectNodeId] : []),
    ...Object.values(cinema.scenes)
      .filter((scene) => acceptedSceneIds.has(scene.id))
      .map((scene) => scene.nodeId),
    ...Object.values(cinema.shots)
      .filter((shot) => acceptedSceneIds.has(shot.sceneId))
      .map((shot) => shot.nodeId),
    ...Object.values(cinema.characters)
      .filter((character) => character.sceneIds.some((sceneId) => acceptedSceneIds.has(sceneId)))
      .map((character) => character.nodeId),
    ...Object.values(cinema.assets)
      .filter((asset) => asset.sceneIds.some((sceneId) => acceptedSceneIds.has(sceneId)))
      .map((asset) => asset.nodeId),
    ...Object.values(cinema.agentRuns)
      .filter((run) => acceptedSceneIds.has(run.sceneId))
      .map((run) => run.nodeId),
  ]);
}

function semanticDescendantIds(nodes: EditorNode[], edges: EditorEdge[], rootId: string) {
  const children = new Map<string, string[]>();
  for (const edge of edges.filter((candidate) => isStructuralEdge(nodes, candidate))) {
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
  const descendants = semanticDescendantIds(nodes, edges, rootId);
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

function directStructuralChildren(nodes: EditorNode[], edges: EditorEdge[], parentId: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.source === parentId && isStructuralEdge(nodes, edge))
    .map((edge) => byId.get(edge.target))
    .filter((node): node is EditorNode => Boolean(node && !node.hidden));
}

function numberedOrder(node: EditorNode, expectedRole: CinemaDraftRole) {
  if (role(node) !== expectedRole) return Number.POSITIVE_INFINITY;
  const text = node.data.kind === 'concept' ? `${node.data.name} ${node.data.label}` : '';
  const match = text.match(new RegExp(`${expectedRole.replace('-', '[ -]?')}\\s*0*(\\d+)`, 'i'));
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function orderedSceneChildren(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema: CinemaProjectData | undefined,
  storyId: string,
) {
  const sceneOrder = new Map(
    (cinema?.sceneOrder ?? [])
      .map((sceneId, index) => [cinema?.scenes[sceneId]?.nodeId, index] as const)
      .filter((entry): entry is readonly [string, number] => Boolean(entry[0])),
  );
  const candidates = directStructuralChildren(nodes, edges, storyId)
    .filter((node) => role(node) === 'scene');
  const edgeOrder = new Map(candidates.map((node, index) => [node.id, index]));
  return candidates
    .sort((left, right) => (
      (sceneOrder.get(left.id) ?? Number.POSITIVE_INFINITY) - (sceneOrder.get(right.id) ?? Number.POSITIVE_INFINITY)
      || (edgeOrder.get(left.id) ?? Number.POSITIVE_INFINITY) - (edgeOrder.get(right.id) ?? Number.POSITIVE_INFINITY)
      || numberedOrder(left, 'scene') - numberedOrder(right, 'scene')
      || left.position.y - right.position.y
      || left.position.x - right.position.x
      || left.id.localeCompare(right.id)
    ));
}

function orderedProductionChildren(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema: CinemaProjectData | undefined,
  sceneId: string,
) {
  const scene = Object.values(cinema?.scenes ?? {}).find((candidate) => candidate.nodeId === sceneId);
  const shotOrder = new Map(
    (scene?.shotIds ?? [])
      .map((shotId, index) => [cinema?.shots[shotId]?.nodeId, index] as const)
      .filter((entry): entry is readonly [string, number] => Boolean(entry[0])),
  );
  const roleOrder: Partial<Record<CinemaDraftRole, number>> = {
    character: 1, location: 2, prop: 3, 'visual-element': 4, shot: 5, note: 6,
  };
  const candidates = directStructuralChildren(nodes, edges, sceneId)
    .filter((node) => {
      const childRole = role(node);
      return childRole !== null && childRole !== 'story' && childRole !== 'scene';
    });
  const edgeOrder = new Map(candidates.map((node, index) => [node.id, index]));
  return candidates
    .sort((left, right) => (
      (shotOrder.get(left.id) ?? Number.POSITIVE_INFINITY) - (shotOrder.get(right.id) ?? Number.POSITIVE_INFINITY)
      || (roleOrder[role(left)!] ?? 99) - (roleOrder[role(right)!] ?? 99)
      || (edgeOrder.get(left.id) ?? Number.POSITIVE_INFINITY) - (edgeOrder.get(right.id) ?? Number.POSITIVE_INFINITY)
      || numberedOrder(left, role(left)!) - numberedOrder(right, role(right)!)
      || left.position.y - right.position.y
      || left.position.x - right.position.x
      || left.id.localeCompare(right.id)
    ));
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
 * Reflows editable cinema drafts around the first Story -> Scene route. Provider-owned
 * and locked nodes are anchors; unrelated graph branches never participate.
 */
export function planCinemaWorkspaceReorganization(
  nodes: EditorNode[],
  edges: EditorEdge[],
  cinema?: CinemaProjectData,
): CinemaWorkspaceLayout {
  const positions = new Map<string, NodePosition>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const fixedIds = cinemaHostIds(cinema);
  const stories = nodes.filter((node) => !node.hidden && role(node) === 'story');
  let handled = false;

  const movable = (node: EditorNode) => !node.data.locked && !fixedIds.has(node.id);
  const currentPosition = (node: EditorNode) => positions.get(node.id) ?? node.position;
  const moveBranch = (rootId: string, delta: NodePosition) => {
    for (const id of semanticDescendantIds(nodes, edges, rootId)) {
      const node = byId.get(id);
      if (!node || node.hidden || !movable(node)) continue;
      const current = currentPosition(node);
      positions.set(id, { x: current.x + delta.x, y: current.y + delta.y });
    }
  };

  for (const story of stories) {
    const scenes = orderedSceneChildren(nodes, edges, cinema, story.id);
    if (!scenes.length) continue;
    handled = true;
    const direction = inferDirection(nodes, edges, story.id, 'scene');

    // Keep explicit bottom -> top legacy trees on their established axis. Typed
    // insertion already extends these horizontally and must not silently rotate them.
    if (direction === 'vertical') continue;

    const sceneLaneX = scenes[0].position.x;
    let cursorTop = scenes[0].position.y;
    for (const scene of scenes) {
      const branchIds = semanticDescendantIds(nodes, edges, scene.id);
      const branchHasAnchor = [...branchIds].some((id) => {
        const node = byId.get(id);
        return Boolean(node && !movable(node));
      });
      if (branchHasAnchor) {
        const bounds = branchBounds(nodes, edges, scene.id, positions);
        if (bounds) cursorTop = Math.max(cursorTop, bounds.bottom + CONCEPT_BRANCH_GAP);
        continue;
      }

      const sceneSize = editorNodeDimensions(scene);
      const children = orderedProductionChildren(nodes, edges, cinema, scene.id);
      if (!children.length) {
        positions.set(scene.id, { x: sceneLaneX, y: cursorTop });
        cursorTop += sceneSize.height + CONCEPT_BRANCH_GAP;
        continue;
      }

      const childLaneX = Math.max(
        children[0].position.x,
        sceneLaneX + sceneSize.width + CONCEPT_LEVEL_GAP,
      );
      let childCursor = cursorTop;
      for (const child of children) {
        const bounds = branchBounds(nodes, edges, child.id, positions);
        if (!bounds) continue;
        const current = currentPosition(child);
        moveBranch(child.id, { x: childLaneX - current.x, y: childCursor - bounds.top });
        const movedBounds = branchBounds(nodes, edges, child.id, positions);
        childCursor = (movedBounds?.bottom ?? childCursor + editorNodeDimensions(child).height)
          + CONCEPT_BRANCH_GAP;
      }

      const childRectangles = children.map((child) => positionedRectangle(child, positions));
      const childTop = Math.min(...childRectangles.map((rectangle) => rectangle.y));
      const childBottom = Math.max(...childRectangles.map((rectangle) => rectangle.y + rectangle.height));
      positions.set(scene.id, {
        x: sceneLaneX,
        y: childTop + (childBottom - childTop - sceneSize.height) / 2,
      });
      const bandBounds = branchBounds(nodes, edges, scene.id, positions);
      cursorTop = (bandBounds?.bottom ?? childBottom) + CONCEPT_BRANCH_GAP;
    }

    if (movable(story)) {
      const sceneRectangles = scenes.map((scene) => positionedRectangle(scene, positions));
      const top = Math.min(...sceneRectangles.map((rectangle) => rectangle.y));
      const bottom = Math.max(...sceneRectangles.map((rectangle) => rectangle.y + rectangle.height));
      const storyHeight = editorNodeDimensions(story).height;
      const storyWidth = editorNodeDimensions(story).width;
      positions.set(story.id, {
        x: Math.min(story.position.x, sceneLaneX - storyWidth - CONCEPT_LEVEL_GAP),
        y: top + (bottom - top - storyHeight) / 2,
      });
    }
  }

  for (const [id, position] of [...positions]) {
    const node = byId.get(id);
    if (!node || (position.x === node.position.x && position.y === node.position.y)) positions.delete(id);
  }
  return { handled, positions };
}

/**
 * Places one new typed cinema node in its parent's established lane, then runs
 * the shared workspace reorganization so eligible draft ancestors and later
 * draft bands remain balanced in the same atomic command.
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
      .filter((edge) => edge.source === parent.id && isStructuralEdge(layoutNodes, edge))
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
        && isStructuralEdge(nodes, edge)
        && role(nodes.find((node) => node.id === edge.source)) === 'story'
      ));
      if (storyEdge) {
        const sceneIds = edges
          .filter((edge) => edge.source === storyEdge.source && isStructuralEdge(layoutNodes, edge))
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
            for (const descendantId of semanticDescendantIds(layoutNodes, layoutEdges, scene.id)) {
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

  const previewEdge: EditorEdge = {
    id: `layout-workspace-${newNode.id}`,
    source: parent.id,
    target: newNode.id,
    data: {
      label: '', kind: 'default',
      relationship: newRole === 'scene' || newRole === 'shot' ? 'hierarchy' : 'attachment',
    },
  };
  const previewNodes = [...nodes, newNode].map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
  const reorganization = planCinemaWorkspaceReorganization(
    previewNodes,
    [...edges, previewEdge],
    cinema,
  );
  for (const [id, planned] of reorganization.positions) positions.set(id, planned);

  const finalPosition = positions.get(newNode.id) ?? position;
  return direction === 'vertical'
    ? { position: finalPosition, positions, direction, sourceHandle: 'bottom', targetHandle: 'top' }
    : { position: finalPosition, positions, direction };
}
