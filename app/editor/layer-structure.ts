import { cinemaDraftRole, type CinemaDraftRole } from '../domain/cinema/manual-creation';
import { isCinemaHierarchyEdgeInIndex } from './cinema-hierarchy';
import { richTextToPlainText } from './rich-text';
import type { EditorEdge, EditorNode } from './types';

export type LayerStructureWarning = 'multiple-parents' | 'cycle';
export type LayerStructureSection = 'structure' | 'unassigned';

export type LayerStructureRow = {
  nodeId: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  section: LayerStructureSection;
  warning?: LayerStructureWarning;
};

export type LayerStructureModel = {
  rows: LayerStructureRow[];
  matchCount: number;
  totalCount: number;
  unassignedCount: number;
};

const roleOrder: Record<CinemaDraftRole, number> = {
  story: 0,
  scene: 1,
  shot: 2,
  character: 3,
  location: 4,
  prop: 5,
  'visual-element': 6,
  note: 7,
};
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const legacyAttachmentRoles = new Set<CinemaDraftRole>([
  'character',
  'location',
  'prop',
  'visual-element',
  'note',
]);

function nodeRole(node: EditorNode | undefined) {
  return node?.data.kind === 'concept'
    ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
    : null;
}

function isStructuralEdge(edge: EditorEdge, byId: ReadonlyMap<string, EditorNode>) {
  if (!byId.has(edge.source) || !byId.has(edge.target) || edge.source === edge.target) return false;
  if (isCinemaHierarchyEdgeInIndex(byId, edge)) return true;
  if (edge.data?.relationship === 'attachment') return true;
  if (edge.data?.relationship !== undefined) return false;
  const targetRole = nodeRole(byId.get(edge.target));
  return targetRole !== null && legacyAttachmentRoles.has(targetRole);
}

function searchableText(node: EditorNode) {
  return [
    node.data.name,
    node.data.kind === 'concept' ? node.data.label : '',
    node.data.kind === 'concept' ? node.data.eyebrow : '',
    node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '',
  ].join(' ').toLocaleLowerCase();
}

export function buildLayerStructure(
  nodes: EditorNode[],
  edges: EditorEdge[],
  searchQuery = '',
  collapsedIds: ReadonlySet<string> = new Set(),
): LayerStructureModel {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const candidates = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!isStructuralEdge(edge, byId)) continue;
    const parents = candidates.get(edge.target) ?? new Set<string>();
    parents.add(edge.source);
    candidates.set(edge.target, parents);
  }

  const warnings = new Map<string, LayerStructureWarning>();
  const parentById = new Map<string, string>();
  for (const [nodeId, parents] of candidates) {
    if (parents.size === 1) parentById.set(nodeId, [...parents][0]);
    else if (parents.size > 1) warnings.set(nodeId, 'multiple-parents');
  }

  for (const node of nodes) {
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let currentId: string | undefined = node.id;
    while (currentId !== undefined) {
      const existingIndex = pathIndex.get(currentId);
      if (existingIndex !== undefined) {
        for (const cycleId of path.slice(existingIndex)) warnings.set(cycleId, 'cycle');
        break;
      }
      pathIndex.set(currentId, path.length);
      path.push(currentId);
      currentId = parentById.get(currentId);
    }
  }
  for (const [nodeId, warning] of warnings) {
    if (warning === 'cycle' || warning === 'multiple-parents') parentById.delete(nodeId);
  }

  const childrenById = new Map<string, string[]>();
  for (const [childId, parentId] of parentById) {
    const children = childrenById.get(parentId) ?? [];
    children.push(childId);
    childrenById.set(parentId, children);
  }
  const compareIds = (leftId: string, rightId: string) => {
    const left = byId.get(leftId)!;
    const right = byId.get(rightId)!;
    const leftRole = nodeRole(left);
    const rightRole = nodeRole(right);
    const roleDifference = (leftRole === null ? 99 : roleOrder[leftRole])
      - (rightRole === null ? 99 : roleOrder[rightRole]);
    return roleDifference
      || collator.compare(left.data.name, right.data.name)
      || (indexById.get(leftId) ?? 0) - (indexById.get(rightId) ?? 0)
      || leftId.localeCompare(rightId);
  };
  for (const children of childrenById.values()) children.sort(compareIds);

  const rootIds = nodes.filter((node) => !parentById.has(node.id)).map((node) => node.id);
  const structureRoots = rootIds.filter((id) => nodeRole(byId.get(id)) === 'story').sort(compareIds);
  const unassignedRoots = rootIds.filter((id) => nodeRole(byId.get(id)) !== 'story').sort(compareIds);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const directMatches = normalizedSearch
    ? new Set(nodes.filter((node) => searchableText(node).includes(normalizedSearch)).map((node) => node.id))
    : new Set(nodes.map((node) => node.id));
  const included = new Set(directMatches);
  if (normalizedSearch) {
    for (const matchId of directMatches) {
      let parentId = parentById.get(matchId);
      while (parentId !== undefined && !included.has(parentId)) {
        included.add(parentId);
        parentId = parentById.get(parentId);
      }
    }
  }

  const rows: LayerStructureRow[] = [];
  const visit = (nodeId: string, depth: number, section: LayerStructureSection) => {
    if (!included.has(nodeId)) return;
    const includedChildren = (childrenById.get(nodeId) ?? []).filter((childId) => included.has(childId));
    rows.push({
      nodeId,
      parentId: parentById.get(nodeId) ?? null,
      depth,
      hasChildren: includedChildren.length > 0,
      section,
      ...(warnings.has(nodeId) ? { warning: warnings.get(nodeId) } : {}),
    });
    if (!normalizedSearch && collapsedIds.has(nodeId)) return;
    for (const childId of includedChildren) visit(childId, depth + 1, section);
  };
  for (const rootId of structureRoots) visit(rootId, 1, 'structure');
  for (const rootId of unassignedRoots) visit(rootId, 1, 'unassigned');

  const unassignedIds = new Set<string>();
  const collectUnassigned = (id: string) => {
    if (unassignedIds.has(id)) return;
    unassignedIds.add(id);
    for (const childId of childrenById.get(id) ?? []) collectUnassigned(childId);
  };
  for (const rootId of unassignedRoots) collectUnassigned(rootId);

  return {
    rows,
    matchCount: directMatches.size,
    totalCount: nodes.length,
    unassignedCount: unassignedIds.size,
  };
}
