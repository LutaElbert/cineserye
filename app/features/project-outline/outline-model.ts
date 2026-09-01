import type { MockCinemaProject } from '../../domain/cinema/prompt-artifacts';
import type { EditorNode } from '../../editor/types';

export type CinemaOutlineGroupId =
  | 'planning'
  | 'characters'
  | 'locations'
  | 'props'
  | 'visual-elements'
  | 'shots'
  | 'assets';

export type CinemaOutlineItem = {
  nodeId: string;
  title: string;
  kind: string;
  metricLabel: string;
  statusLabel: string;
  hidden: boolean;
  locked: boolean;
  proposed: boolean;
};

export type CinemaOutlineGroup = {
  id: CinemaOutlineGroupId;
  label: string;
  items: CinemaOutlineItem[];
};

export type CinemaOutlineModel = {
  project: CinemaOutlineItem | null;
  scene: CinemaOutlineItem;
  groups: CinemaOutlineGroup[];
  shotCount: number;
  targetDurationSeconds: number;
  expectedCost: number;
  currency: 'PHP' | 'USD';
  visibleItemCount: number;
  totalItemCount: number;
};

const GROUPS: ReadonlyArray<{ id: CinemaOutlineGroupId; label: string }> = [
  { id: 'planning', label: 'Planning' },
  { id: 'characters', label: 'Characters' },
  { id: 'locations', label: 'Locations' },
  { id: 'props', label: 'Props' },
  { id: 'visual-elements', label: 'Visual Elements' },
  { id: 'shots', label: 'Shots' },
  { id: 'assets', label: 'Other Assets' },
];

function assetGroup(project: MockCinemaProject, nodeId: string): CinemaOutlineGroupId {
  const category = project.nodes[nodeId]?.fields
    .find((field) => field.label.toLocaleLowerCase() === 'category')
    ?.value.toLocaleLowerCase();
  if (category === 'location') return 'locations';
  if (category === 'prop') return 'props';
  if (category === 'visual element') return 'visual-elements';
  return 'assets';
}

function groupForNode(project: MockCinemaProject, nodeId: string): CinemaOutlineGroupId | null {
  const detail = project.nodes[nodeId];
  if (!detail) return null;
  if (detail.kind === 'agent-run') return 'planning';
  if (detail.kind === 'character') return 'characters';
  if (detail.kind === 'shot') return 'shots';
  if (detail.kind === 'asset') return assetGroup(project, nodeId);
  return null;
}

function toItem(
  node: EditorNode,
  project: MockCinemaProject,
  proposedNodeIds: ReadonlySet<string>,
): CinemaOutlineItem {
  const detail = project.nodes[node.id];
  return {
    nodeId: node.id,
    title: node.data.name,
    kind: detail.kind,
    metricLabel: detail.metricLabel,
    statusLabel: detail.statusLabel,
    hidden: Boolean(node.hidden),
    locked: node.data.locked,
    proposed: proposedNodeIds.has(node.id),
  };
}

function includesQuery(item: CinemaOutlineItem, query: string) {
  if (!query) return true;
  return `${item.title} ${item.kind} ${item.metricLabel} ${item.statusLabel}`
    .toLocaleLowerCase()
    .includes(query);
}

export function buildCinemaOutline(
  nodes: readonly EditorNode[],
  project: MockCinemaProject,
  proposedNodeIds: ReadonlySet<string>,
  searchQuery = '',
): CinemaOutlineModel {
  const available = new Map(nodes.map((node) => [node.id, node]));
  const query = searchQuery.trim().toLocaleLowerCase();
  const storyEntry = Object.values(project.nodes).find((detail) => detail.kind === 'story');
  const storyNode = storyEntry ? available.get(storyEntry.nodeId) : undefined;
  const sceneNode = available.get(project.sceneNodeId);
  if (!sceneNode) throw new Error('The cinema outline requires its scene node.');

  const projectItem = storyNode ? toItem(storyNode, project, proposedNodeIds) : null;
  const sceneItem = toItem(sceneNode, project, proposedNodeIds);
  const shotOrder = new Map(project.shotNodeIds.map((nodeId, index) => [nodeId, index]));
  const grouped = new Map<CinemaOutlineGroupId, CinemaOutlineItem[]>();

  for (const node of nodes) {
    if (node.id === storyNode?.id || node.id === sceneNode.id || !project.nodes[node.id]) continue;
    const groupId = groupForNode(project, node.id);
    if (!groupId) continue;
    const item = toItem(node, project, proposedNodeIds);
    const current = grouped.get(groupId) ?? [];
    current.push(item);
    grouped.set(groupId, current);
  }

  const allGroups = GROUPS.flatMap(({ id, label }) => {
    const items = grouped.get(id) ?? [];
    if (id === 'shots') {
      items.sort((a, b) => (shotOrder.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER)
        - (shotOrder.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER));
    } else {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
    return items.length ? [{ id, label, items }] : [];
  });
  const totalItemCount = Number(Boolean(projectItem)) + 1
    + allGroups.reduce((total, group) => total + group.items.length, 0);
  const groups = allGroups.flatMap((group) => {
    const items = group.items.filter((item) => includesQuery(item, query));
    return items.length ? [{ ...group, items }] : [];
  });
  const rootMatches = [projectItem, sceneItem].filter((item): item is CinemaOutlineItem => Boolean(item))
    .filter((item) => includesQuery(item, query)).length;

  return {
    project: projectItem,
    scene: sceneItem,
    groups,
    shotCount: project.shotNodeIds.filter((nodeId) => available.has(nodeId)).length,
    targetDurationSeconds: project.targetDurationSeconds,
    expectedCost: project.cost.expected,
    currency: project.cost.currency,
    visibleItemCount: query
      ? rootMatches + groups.reduce((total, group) => total + group.items.length, 0)
      : totalItemCount,
    totalItemCount,
  };
}
