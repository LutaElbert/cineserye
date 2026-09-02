import { MarkerType } from '@xyflow/react';
import type { CinemaAssetRecord, CinemaProjectData } from '../domain/cinema/project-data';
import type { CanvasCommandProposal } from './canvas-commands';
import {
  editorNodeDimensions,
  LAYOUT_COLUMN_GAP,
  verticalNodeLane,
} from './node-layout';
import {
  conceptTitleFromPlainText,
  richTextFromPlainText,
  richTextToPlainText,
} from './rich-text';
import type { EditorDocument, EditorEdge, EditorNode } from './types';

const CINEMA_LANE_GAP = 90;

function wrappedLineCount(value: string, charactersPerLine: number): number {
  return value.split(/\r?\n/).reduce((total, line) => (
    total + Math.max(1, Math.ceil(line.trim().length / charactersPerLine))
  ), 0);
}

function estimatedConceptHeight(title: string, body: string): number {
  const titleHeight = wrappedLineCount(title, 27) * 18;
  const bodyHeight = body.trim() ? wrappedLineCount(body, 38) * 15 + 7 : 0;
  return Math.max(88, 42 + titleHeight + bodyHeight + 14);
}

function withEstimatedCinemaNodeHeights(nodes: EditorNode[], ids: Set<string>): EditorNode[] {
  return nodes.map((node) => {
    if (!ids.has(node.id) || node.data.kind !== 'concept') return node;
    const estimatedHeight = estimatedConceptHeight(
      richTextToPlainText(node.data.title),
      richTextToPlainText(node.data.body),
    );
    const currentHeight = Number(node.style?.height) || 0;
    if (currentHeight >= estimatedHeight) return node;
    return { ...node, style: { ...node.style, height: estimatedHeight } };
  });
}

function conceptNode(
  id: string,
  title: string,
  eyebrow: string,
  body: string,
  tone: 'ink' | 'indigo' | 'mint',
  position: { x: number; y: number },
): EditorNode {
  return {
    id,
    type: 'concept',
    position,
    style: { width: 250, height: estimatedConceptHeight(title, body) },
    draggable: false,
    deletable: false,
    data: {
      kind: 'concept',
      name: title,
      label: title,
      title: conceptTitleFromPlainText(title),
      body: richTextFromPlainText(body),
      eyebrow,
      tone,
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

function cinemaPlanNodeIds(cinema: CinemaProjectData, nodes: EditorNode[]) {
  const existingIds = new Set(nodes.map((node) => node.id));
  const sceneId = cinema.activeSceneId;
  const scene = sceneId ? cinema.scenes[sceneId] : undefined;
  if (!scene) return { contextIds: [], shotIds: [] };
  const contextIds = [
    ...Object.values(cinema.agentRuns).map((run) => run.nodeId),
    ...Object.values(cinema.characters)
      .filter((character) => character.sceneIds.includes(scene.id))
      .map((character) => character.nodeId),
    ...Object.values(cinema.assets)
      .filter((asset) => asset.sceneIds.includes(scene.id))
      .map((asset) => asset.nodeId),
  ].filter((id) => existingIds.has(id));
  const shotIds = scene.shotIds
    .map((shotId) => cinema.shots[shotId]?.nodeId)
    .filter((id): id is string => Boolean(id && existingIds.has(id)));
  return { contextIds, shotIds };
}

/** Packs only cinema-generated hosts around the existing scene anchor. */
export function layoutCinemaProposalNodes(
  nodes: EditorNode[],
  cinema: CinemaProjectData,
): EditorNode[] {
  const sceneId = cinema.activeSceneId;
  const sceneNodeId = sceneId ? cinema.scenes[sceneId]?.nodeId : null;
  const sceneNode = sceneNodeId ? nodes.find((node) => node.id === sceneNodeId) : null;
  if (!sceneNode) return nodes;

  const { contextIds, shotIds } = cinemaPlanNodeIds(cinema, nodes);
  if (!contextIds.length && !shotIds.length) return nodes;
  const sizedNodes = withEstimatedCinemaNodeHeights(
    nodes,
    new Set([...contextIds, ...shotIds]),
  );
  const sceneSize = editorNodeDimensions(sceneNode);
  const contextDraft = verticalNodeLane(sizedNodes, contextIds, 0, 0);
  const shotDraft = verticalNodeLane(sizedNodes, shotIds, 0, 0);
  const tallestLane = Math.max(contextDraft.height, shotDraft.height);
  const startY = Math.max(
    20,
    Math.round(sceneNode.position.y + sceneSize.height / 2 - tallestLane / 2),
  );
  const contextX = Math.round(sceneNode.position.x + sceneSize.width + CINEMA_LANE_GAP);
  const contextLane = verticalNodeLane(sizedNodes, contextIds, contextX, startY);
  const shotX = contextX + contextLane.width + LAYOUT_COLUMN_GAP;
  const shotLane = verticalNodeLane(sizedNodes, shotIds, shotX, startY);
  const positions = new Map([...contextLane.positions, ...shotLane.positions]);

  return sizedNodes.map((node) => {
    const position = positions.get(node.id);
    if (!position || (
      Math.abs(node.position.x - position.x) < 0.5
      && Math.abs(node.position.y - position.y) < 0.5
    )) return node;
    return { ...node, position };
  });
}

/** Detects the fixed-height layout emitted before dimension-aware plan packing. */
export function cinemaPlanNeedsLayoutMigration(
  nodes: EditorNode[],
  cinema: CinemaProjectData,
): boolean {
  const { contextIds, shotIds } = cinemaPlanNodeIds(cinema, nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const generated = [...contextIds, ...shotIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is EditorNode => Boolean(node));
  return generated.length > 0 && generated.every((node) => (
    node.data.kind !== 'concept' || (Number(node.style?.height) || 0) <= 88
  ));
}

function edge(id: string, source: string, target: string): EditorEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#a9adb7', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: '', kind: 'default' },
  };
}

function assetEyebrow(asset: CinemaAssetRecord) {
  if (asset.category === 'location') return 'Location';
  if (asset.category === 'prop') return 'Prop';
  if (asset.category === 'visual-element') return 'Visual element';
  return 'Asset';
}

function ceilingLabel(project: CinemaProjectData, sceneId: string) {
  const scene = project.scenes[sceneId];
  const cost = Object.values(project.costs).find((item) => item.sceneId === sceneId);
  if (!cost || cost.ceiling === null) {
    return `${scene.brief?.productionConstraints.budgetBand ?? 'custom'} production · ${cost?.pricingMode ?? 'unpriced'} generation`;
  }
  const unit = cost.pricingMode === 'credits' ? 'credits' : cost.currency;
  return `${unit} ${cost.ceiling.toLocaleString('en-US')} generation ceiling`;
}

/** Deterministically projects a validated cinema sidecar into generic canvas commands. */
export function compileCinemaCanvasProposal(
  runId: string,
  cinema: CinemaProjectData,
): CanvasCommandProposal {
  const sceneId = cinema.activeSceneId;
  if (!sceneId) throw new Error('A canvas proposal requires an active scene.');
  const scene = cinema.scenes[sceneId];
  const run = cinema.agentRuns[runId];
  if (!scene || !run) throw new Error('A canvas proposal requires a scene and agent run.');

  const characters = Object.values(cinema.characters)
    .filter((character) => character.sceneIds.includes(sceneId));
  const assets = Object.values(cinema.assets)
    .filter((asset) => asset.sceneIds.includes(sceneId));
  const shots = scene.shotIds.map((shotId) => cinema.shots[shotId]);
  const planningDraft: EditorNode[] = [
    conceptNode(
      run.nodeId,
      'Research + Shot Planning',
      'Agent run',
      `${run.status === 'ready' ? 'Ready' : run.status} · ${shots.length} shots · ${run.sourceIds.length} sources`,
      'indigo',
      { x: 740, y: 20 },
    ),
    ...characters.map((character) => conceptNode(
      character.nodeId,
      character.title,
      'Character',
      character.summary,
      'mint',
      { x: 740, y: 20 },
    )),
    ...assets.map((asset) => conceptNode(
      asset.nodeId,
      asset.title,
      assetEyebrow(asset),
      asset.summary,
      asset.category === 'visual-element' ? 'indigo' : 'ink',
      { x: 740, y: 20 },
    )),
  ];
  const planningLane = verticalNodeLane(
    planningDraft,
    planningDraft.map((node) => node.id),
    740,
    20,
  );
  const planningNodes = planningDraft.map((node) => ({
    ...node,
    position: planningLane.positions.get(node.id) ?? node.position,
  }));
  const shotDraft = shots.map((shot, index) => conceptNode(
    shot.nodeId,
    `${String(index + 1).padStart(2, '0')} · ${shot.title}`,
    'Shot',
    `${shot.durationSeconds}s · ${shot.framing} · ${shot.risk} risk`,
    shot.risk === 'high' ? 'indigo' : 'mint',
    { x: 1_090, y: 20 },
  ));
  const shotLane = verticalNodeLane(
    shotDraft,
    shotDraft.map((node) => node.id),
    740 + planningLane.width + LAYOUT_COLUMN_GAP,
    20,
  );
  const shotNodes = shotDraft.map((node) => ({
    ...node,
    position: shotLane.positions.get(node.id) ?? node.position,
  }));
  const createdNodes = [...planningNodes, ...shotNodes];
  const createdEdges = [
    edge(`${runId}-scene-agent-plan`, scene.nodeId, run.nodeId),
    ...characters.map((character, index) => edge(
      `${runId}-scene-character-${index + 1}`,
      scene.nodeId,
      character.nodeId,
    )),
    ...assets.map((asset, index) => edge(
      `${runId}-scene-asset-${index + 1}`,
      scene.nodeId,
      asset.nodeId,
    )),
    ...(shots[0] ? [edge(`${runId}-agent-shot-01`, run.nodeId, shots[0].nodeId)] : []),
    ...shots.slice(1).map((shot, index) => edge(
      `${runId}-shot-${index + 1}-shot-${index + 2}`,
      shots[index].nodeId,
      shot.nodeId,
    )),
  ];
  const sceneConstraintSummary = `${scene.brief?.locationPeriod ?? ''} · ${scene.brief?.genreTone ?? ''} · ${scene.brief?.targetDurationSeconds ?? 0}s · ${ceilingLabel(cinema, sceneId)}`;

  return {
    version: 1,
    proposalId: `${runId}-canvas-proposal`,
    summary: `Create a validated ${shots.length}-shot prompt package with reusable continuity references.`,
    commands: [
      ...(cinema.projectNodeId ? [{
        type: 'update-node',
        id: cinema.projectNodeId,
        patch: {
          position: { x: 80, y: 330 },
          style: { width: 250, height: estimatedConceptHeight('Story Premise', scene.synopsis) },
          data: { body: richTextFromPlainText(scene.synopsis), eyebrow: 'Story premise', tone: 'indigo' },
        },
      } as const] : []),
      {
        type: 'update-node',
        id: scene.nodeId,
        patch: {
          position: { x: 400, y: 330 },
          style: { width: 250, height: estimatedConceptHeight(scene.title, sceneConstraintSummary) },
          data: {
            name: scene.title,
            label: scene.title,
            title: conceptTitleFromPlainText(scene.title),
            body: richTextFromPlainText(sceneConstraintSummary),
            eyebrow: 'Scene',
            tone: 'ink',
          },
        },
      },
      ...createdNodes.map((node) => ({ type: 'create-node' as const, node })),
      ...createdEdges.map((createdEdge) => ({ type: 'connect-nodes' as const, edge: createdEdge })),
      ...createdNodes.map((node) => ({
        type: 'update-node' as const,
        id: node.id,
        patch: { data: { locked: true } },
      })),
    ],
  };
}

function activePlanHostIds(cinema: CinemaProjectData | undefined): string[] {
  if (!cinema?.activeSceneId) return [];
  const sceneId = cinema.activeSceneId;
  return [
    ...Object.values(cinema.shots).filter((record) => record.sceneId === sceneId).map((record) => record.nodeId),
    ...Object.values(cinema.characters).filter((record) => record.sceneIds.length === 1 && record.sceneIds[0] === sceneId).map((record) => record.nodeId),
    ...Object.values(cinema.assets).filter((record) => record.sceneIds.length === 1 && record.sceneIds[0] === sceneId).map((record) => record.nodeId),
    ...Object.values(cinema.agentRuns).filter((record) => record.sceneId === sceneId).map((record) => record.nodeId),
  ];
}

/** Replaces only the current accepted plan hosts; story and scene hosts remain stable. */
export function prepareCinemaPlanProposal(
  source: EditorDocument,
  currentCinema: CinemaProjectData | undefined,
  proposal: CanvasCommandProposal,
): CanvasCommandProposal {
  const sourceNodeIds = new Set(source.nodes.map((node) => node.id));
  const sourceNodeById = new Map(source.nodes.map((node) => [node.id, node]));
  const replacements = activePlanHostIds(currentCinema).filter((nodeId) => sourceNodeIds.has(nodeId));
  if (!currentCinema && sourceNodeIds.has('shot-01')) replacements.push('shot-01');
  const commands = proposal.commands
    .filter((command) => command.type !== 'delete-nodes')
    .map((command) => {
      if (command.type !== 'update-node' || !sourceNodeIds.has(command.id)) return command;
      const sourceNode = sourceNodeById.get(command.id);
      const sourceWidth = Number(sourceNode?.style?.width) || Number(sourceNode?.measured?.width) || 0;
      const sourceHeight = Number(sourceNode?.style?.height) || 0;
      const proposedStyle = command.patch.style ?? (
        sourceNode?.data.kind === 'concept' && command.patch.data ? { width: 250 } : undefined
      );
      const proposedHeight = Number(proposedStyle?.height) || 0;
      return {
        ...command,
        patch: {
          ...command.patch,
          position: undefined,
          ...(proposedStyle ? {
            style: {
              ...proposedStyle,
              ...((sourceWidth || proposedStyle.width) ? { width: sourceWidth || proposedStyle.width } : {}),
              ...(sourceHeight || proposedHeight ? { height: Math.max(sourceHeight, proposedHeight) } : {}),
            },
          } : {}),
        },
      };
    });
  return {
    ...proposal,
    commands: replacements.length
      ? [{ type: 'delete-nodes', ids: [...new Set(replacements)] }, ...commands]
      : commands,
  };
}

/** Proposal preview validates canvas changes independently from the pending replacement sidecar. */
export function cinemaProposalCanvasSource(source: EditorDocument): EditorDocument {
  const canvas = structuredClone(source);
  const replaceableHostIds = new Set(activePlanHostIds(canvas.cinema));
  canvas.nodes = canvas.nodes.map((node) => replaceableHostIds.has(node.id)
    ? {
        ...node,
        draggable: true,
        deletable: true,
        data: { ...node.data, locked: false },
      }
    : node);
  delete canvas.cinema;
  return canvas;
}
