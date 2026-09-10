import { cinemaDraftRole, type CinemaDraftRole } from '../../domain/cinema/manual-creation';
import type { CinemaProjectData } from '../../domain/cinema/project-data';
import { buildLayerStructure, type LayerStructureWarning } from '../../editor/layer-structure';
import type { EditorEdge, EditorNode } from '../../editor/types';

export type UnifiedOutlineGroupId =
  | 'planning'
  | 'characters'
  | 'locations'
  | 'props'
  | 'visual-elements'
  | 'shots'
  | 'notes'
  | 'assets';

export type UnifiedOutlineItemState = 'draft' | 'proposed' | 'production' | 'attention';

export type UnifiedOutlineItem = {
  nodeId: string;
  title: string;
  kind: string;
  metricLabel: string;
  statusLabel: string;
  state: UnifiedOutlineItemState;
  hidden: boolean;
  locked: boolean;
  warning?: LayerStructureWarning;
};

export type UnifiedOutlineGroup = {
  id: UnifiedOutlineGroupId;
  label: string;
  items: UnifiedOutlineItem[];
};

export type UnifiedOutlineScene = {
  item: UnifiedOutlineItem;
  groups: UnifiedOutlineGroup[];
  nodeIds: string[];
  shotCount: number;
  targetDurationSeconds: number;
  allocatedDurationSeconds?: number;
  expectedCostLabel: string;
};

export type UnifiedOutlineModel = {
  project: UnifiedOutlineItem | null;
  scenes: UnifiedOutlineScene[];
  unassigned: UnifiedOutlineItem[];
  visibleItemCount: number;
  totalItemCount: number;
};

const GROUPS: ReadonlyArray<{ id: UnifiedOutlineGroupId; label: string }> = [
  { id: 'planning', label: 'Planning' },
  { id: 'characters', label: 'Characters' },
  { id: 'locations', label: 'Locations' },
  { id: 'props', label: 'Props' },
  { id: 'visual-elements', label: 'Visual Elements' },
  { id: 'shots', label: 'Shots' },
  { id: 'notes', label: 'Notes' },
  { id: 'assets', label: 'Other Assets' },
];

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function formatCost(
  expected: number | null,
  pricingMode: 'unpriced' | 'credits' | 'currency',
  currency: 'PHP' | 'USD' | null,
) {
  if (expected === null || pricingMode === 'unpriced') return 'Unpriced';
  if (pricingMode === 'credits') return `${expected.toLocaleString('en-US')} credits`;
  return new Intl.NumberFormat(currency === 'PHP' ? 'en-PH' : 'en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: currency === 'PHP' ? 0 : 2,
  }).format(expected);
}

function includesQuery(item: UnifiedOutlineItem, query: string) {
  if (!query) return true;
  return `${item.title} ${item.kind} ${item.metricLabel} ${item.statusLabel}`
    .toLocaleLowerCase()
    .includes(query);
}

function domainRole(nodeId: string, cinema: CinemaProjectData | undefined): CinemaDraftRole | 'agent-run' | 'asset' | null {
  if (!cinema) return null;
  if (Object.values(cinema.scenes).some((scene) => scene.nodeId === nodeId)) return 'scene';
  if (Object.values(cinema.shots).some((shot) => shot.nodeId === nodeId)) return 'shot';
  if (Object.values(cinema.characters).some((character) => character.nodeId === nodeId)) return 'character';
  const asset = Object.values(cinema.assets).find((candidate) => candidate.nodeId === nodeId);
  if (asset) {
    if (asset.category === 'location') return 'location';
    if (asset.category === 'prop') return 'prop';
    if (asset.category === 'visual-element') return 'visual-element';
    return 'asset';
  }
  if (Object.values(cinema.agentRuns).some((run) => run.nodeId === nodeId)) return 'agent-run';
  if (cinema.projectNodeId === nodeId) return 'story';
  return null;
}

function nodeRole(node: EditorNode, cinema: CinemaProjectData | undefined) {
  return domainRole(node.id, cinema)
    ?? (node.data.kind === 'concept' ? cinemaDraftRole(node.data.domainType, node.data.eyebrow) : null);
}

function groupForRole(role: ReturnType<typeof nodeRole> | undefined): UnifiedOutlineGroupId | null {
  if (role === 'agent-run') return 'planning';
  if (role === 'character') return 'characters';
  if (role === 'location') return 'locations';
  if (role === 'prop') return 'props';
  if (role === 'visual-element') return 'visual-elements';
  if (role === 'shot') return 'shots';
  if (role === 'note') return 'notes';
  if (role === 'asset') return 'assets';
  return null;
}

function productionStatus(nodeId: string, cinema: CinemaProjectData | undefined) {
  if (!cinema) return null;
  const scene = Object.values(cinema.scenes).find((candidate) => candidate.nodeId === nodeId);
  if (scene) {
    const accepted = Object.values(cinema.revisions)
      .some((revision) => revision.sceneId === scene.id && revision.status === 'active');
    if (accepted) return 'Accepted';
    if (scene.status === 'locked') return 'Locked';
    return 'Draft';
  }
  const shot = Object.values(cinema.shots).find((candidate) => candidate.nodeId === nodeId);
  if (shot) return shot.generationStatus === 'planned' ? 'Prompts ready' : shot.generationStatus.replace('-', ' ');
  const character = Object.values(cinema.characters).find((candidate) => candidate.nodeId === nodeId);
  if (character) return character.sceneIds.length > 1 ? 'Shared' : 'Prompt ready';
  const asset = Object.values(cinema.assets).find((candidate) => candidate.nodeId === nodeId);
  if (asset) return asset.sceneIds.length > 1 ? 'Shared' : asset.category.replace('-', ' ');
  const run = Object.values(cinema.agentRuns).find((candidate) => candidate.nodeId === nodeId);
  if (run) return run.status;
  if (cinema.projectNodeId === nodeId) return 'Project';
  return null;
}

function productionMetric(nodeId: string, cinema: CinemaProjectData | undefined) {
  if (!cinema) return '';
  const shot = Object.values(cinema.shots).find((candidate) => candidate.nodeId === nodeId);
  if (shot) return `${shot.durationSeconds}s · ${shot.framing}`;
  const character = Object.values(cinema.characters).find((candidate) => candidate.nodeId === nodeId);
  if (character && character.sceneIds.length > 1) return `${character.sceneIds.length} scenes`;
  const asset = Object.values(cinema.assets).find((candidate) => candidate.nodeId === nodeId);
  if (asset) {
    const uses = Object.values(cinema.shots).filter((candidate) => candidate.continuityNodeIds.includes(nodeId)).length;
    return uses ? `${uses} ${uses === 1 ? 'shot' : 'shots'}` : '';
  }
  const run = Object.values(cinema.agentRuns).find((candidate) => candidate.nodeId === nodeId);
  if (run) return `${run.proposedCommandCount} changes`;
  return '';
}

function toItem(
  node: EditorNode,
  cinema: CinemaProjectData | undefined,
  proposedNodeIds: ReadonlySet<string>,
  warning?: LayerStructureWarning,
): UnifiedOutlineItem {
  const status = productionStatus(node.id, cinema);
  return {
    nodeId: node.id,
    title: node.data.name,
    kind: nodeRole(node, cinema) ?? node.data.kind,
    metricLabel: productionMetric(node.id, cinema),
    statusLabel: warning ? warning.replace('-', ' ') : proposedNodeIds.has(node.id) ? 'Proposed' : status ?? 'Draft',
    state: warning ? 'attention' : proposedNodeIds.has(node.id) ? 'proposed' : status ? 'production' : 'draft',
    hidden: Boolean(node.hidden),
    locked: node.data.locked,
    ...(warning ? { warning } : {}),
  };
}

function filterModel(model: UnifiedOutlineModel, query: string): UnifiedOutlineModel {
  if (!query) return model;
  const projectMatches = model.project ? includesQuery(model.project, query) : false;
  const directMatchCount = Number(projectMatches)
    + model.scenes.filter((scene) => includesQuery(scene.item, query)).length
    + model.scenes.reduce((total, scene) => total + scene.groups.reduce(
      (subtotal, group) => subtotal + group.items.filter((item) => includesQuery(item, query)).length,
      0,
    ), 0)
    + model.unassigned.filter((item) => includesQuery(item, query)).length;
  const scenes = model.scenes.flatMap((scene) => {
    const sceneMatches = includesQuery(scene.item, query);
    const groups = projectMatches || sceneMatches
      ? scene.groups
      : scene.groups.flatMap((group) => {
          const items = group.items.filter((item) => includesQuery(item, query));
          return items.length ? [{ ...group, items }] : [];
        });
    return projectMatches || sceneMatches || groups.length ? [{ ...scene, groups }] : [];
  });
  const unassigned = model.unassigned.filter((item) => includesQuery(item, query));
  return { ...model, scenes, unassigned, visibleItemCount: directMatchCount };
}

/**
 * Merges graph-derived drafts and cinema production records into one read-only
 * sidebar projection. The returned hierarchy is never persisted.
 */
export function buildUnifiedProjectOutline(
  nodes: readonly EditorNode[],
  edges: readonly EditorEdge[],
  cinema: CinemaProjectData | undefined,
  proposedNodeIds: ReadonlySet<string>,
  searchQuery = '',
): UnifiedOutlineModel {
  const mutableNodes = [...nodes];
  const structure = buildLayerStructure(mutableNodes, [...edges]);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roleById = new Map(nodes.map((node) => [node.id, nodeRole(node, cinema)]));
  const rowById = new Map(structure.rows.map((row) => [row.nodeId, row]));
  const parentById = new Map(structure.rows.flatMap((row) => row.parentId ? [[row.nodeId, row.parentId] as const] : []));
  const storyNode = (cinema?.projectNodeId ? byId.get(cinema.projectNodeId) : undefined)
    ?? nodes.find((node) => roleById.get(node.id) === 'story')
    ?? null;
  const sceneRecordByNodeId = new Map(Object.values(cinema?.scenes ?? {}).map((scene) => [scene.nodeId, scene]));
  const domainSceneNodeIds = new Set(sceneRecordByNodeId.keys());
  const sceneCandidates = nodes.filter((node) => roleById.get(node.id) === 'scene');
  const validSceneNodes = sceneCandidates.filter((node) => (
    domainSceneNodeIds.has(node.id) || (storyNode !== null && parentById.get(node.id) === storyNode.id)
  ));
  const validSceneIds = new Set(validSceneNodes.map((scene) => scene.id));
  const assigned = new Map(validSceneNodes.map((scene) => [scene.id, new Set<string>()]));

  const nearestScene = (nodeId: string) => {
    const visited = new Set<string>();
    let parentId = parentById.get(nodeId);
    while (parentId && !visited.has(parentId)) {
      if (validSceneIds.has(parentId)) return parentId;
      visited.add(parentId);
      parentId = parentById.get(parentId);
    }
    return null;
  };
  for (const node of nodes) {
    if (node.id === storyNode?.id || roleById.get(node.id) === 'scene') continue;
    const sceneNodeId = nearestScene(node.id);
    if (sceneNodeId && groupForRole(roleById.get(node.id))) assigned.get(sceneNodeId)?.add(node.id);
  }

  if (cinema) {
    const sceneNodeForId = (sceneId: string) => cinema.scenes[sceneId]?.nodeId;
    for (const shot of Object.values(cinema.shots)) assigned.get(sceneNodeForId(shot.sceneId) ?? '')?.add(shot.nodeId);
    for (const character of Object.values(cinema.characters)) {
      for (const sceneId of character.sceneIds) assigned.get(sceneNodeForId(sceneId) ?? '')?.add(character.nodeId);
    }
    for (const asset of Object.values(cinema.assets)) {
      for (const sceneId of asset.sceneIds) assigned.get(sceneNodeForId(sceneId) ?? '')?.add(asset.nodeId);
    }
    for (const run of Object.values(cinema.agentRuns)) assigned.get(sceneNodeForId(run.sceneId) ?? '')?.add(run.nodeId);
  }

  const sceneOrder = new Map((cinema?.sceneOrder ?? []).flatMap((sceneId, index) => {
    const nodeId = cinema?.scenes[sceneId]?.nodeId;
    return nodeId ? [[nodeId, index] as const] : [];
  }));
  const structureOrder = new Map(structure.rows.map((row, index) => [row.nodeId, index]));
  validSceneNodes.sort((left, right) => (
    (sceneOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sceneOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    || (structureOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (structureOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    || collator.compare(left.data.name, right.data.name)
    || left.id.localeCompare(right.id)
  ));

  const assignedAnywhere = new Set<string>();
  const scenes = validSceneNodes.map((sceneNode) => {
    const itemIds = [...(assigned.get(sceneNode.id) ?? [])].filter((id) => byId.has(id));
    itemIds.forEach((id) => assignedAnywhere.add(id));
    const grouped = new Map<UnifiedOutlineGroupId, UnifiedOutlineItem[]>();
    for (const id of itemIds) {
      const node = byId.get(id)!;
      const groupId = groupForRole(roleById.get(id));
      if (!groupId) continue;
      const items = grouped.get(groupId) ?? [];
      items.push(toItem(node, cinema, proposedNodeIds, rowById.get(id)?.warning));
      grouped.set(groupId, items);
    }
    const sceneRecord = sceneRecordByNodeId.get(sceneNode.id);
    const shotOrder = new Map((sceneRecord?.shotIds ?? []).flatMap((shotId, index) => {
      const nodeId = cinema?.shots[shotId]?.nodeId;
      return nodeId ? [[nodeId, index] as const] : [];
    }));
    const groups = GROUPS.flatMap(({ id, label }) => {
      const items = grouped.get(id) ?? [];
      items.sort((left, right) => id === 'shots'
        ? (shotOrder.get(left.nodeId) ?? Number.MAX_SAFE_INTEGER) - (shotOrder.get(right.nodeId) ?? Number.MAX_SAFE_INTEGER)
          || collator.compare(left.title, right.title)
        : collator.compare(left.title, right.title));
      return items.length ? [{ id, label, items }] : [];
    });
    const shotItems = groups.find((group) => group.id === 'shots')?.items ?? [];
    const shotNodeIds = new Set(shotItems.map((item) => item.nodeId));
    const targetDurationSeconds = Object.values(cinema?.shots ?? {})
      .filter((shot) => shotNodeIds.has(shot.nodeId))
      .reduce((total, shot) => total + shot.durationSeconds, 0);
    const cost = sceneRecord
      ? Object.values(cinema?.costs ?? {}).find((candidate) => candidate.sceneId === sceneRecord.id)
      : undefined;
    return {
      item: toItem(sceneNode, cinema, proposedNodeIds, rowById.get(sceneNode.id)?.warning),
      groups,
      nodeIds: [sceneNode.id, ...itemIds],
      shotCount: shotItems.length,
      targetDurationSeconds,
      allocatedDurationSeconds: cinema?.storyWorkflow?.sessions.flatMap((session) => session.accepted
        .filter((mapping) => mapping.sceneId === sceneRecord?.id)
        .map((mapping) => session.proposals.find((proposal) => proposal.id === mapping.proposalId)?.durationSeconds)).find((value) => value !== undefined),
      expectedCostLabel: cost ? formatCost(cost.expected, cost.pricingMode, cost.currency) : 'Draft',
    };
  });

  const typedNodeIds = nodes
    .filter((node) => roleById.get(node.id) !== null)
    .map((node) => node.id);
  const unassigned = typedNodeIds
    .filter((id) => id !== storyNode?.id && !validSceneIds.has(id) && !assignedAnywhere.has(id))
    .map((id) => toItem(byId.get(id)!, cinema, proposedNodeIds, rowById.get(id)?.warning))
    .map((item) => ({ ...item, state: 'attention' as const, statusLabel: item.warning?.replace('-', ' ') ?? 'Needs parent' }))
    .sort((left, right) => collator.compare(left.title, right.title) || left.nodeId.localeCompare(right.nodeId));
  const totalItemCount = new Set([
    ...(storyNode ? [storyNode.id] : []),
    ...validSceneNodes.map((scene) => scene.id),
    ...scenes.flatMap((scene) => scene.groups.flatMap((group) => group.items.map((item) => item.nodeId))),
    ...unassigned.map((item) => item.nodeId),
  ]).size;
  const model: UnifiedOutlineModel = {
    project: storyNode ? toItem(storyNode, cinema, proposedNodeIds, rowById.get(storyNode.id)?.warning) : null,
    scenes,
    unassigned,
    visibleItemCount: totalItemCount,
    totalItemCount,
  };
  return filterModel(model, searchQuery.trim().toLocaleLowerCase());
}
