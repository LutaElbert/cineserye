import { MarkerType } from '@xyflow/react';
import type { CinemaAssetRecord, CinemaProjectData } from '../../domain/cinema/project-data';
import type { CanvasCommandProposal } from '../../editor/canvas-commands';
import { conceptTitleFromPlainText, richTextFromPlainText } from '../../editor/rich-text';
import type { EditorEdge, EditorNode } from '../../editor/types';

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
    style: { width: 250, height: 88 },
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
  const planningNodes: EditorNode[] = [
    conceptNode(
      run.nodeId,
      'Research + Shot Planning',
      'Agent run',
      `${run.status === 'ready' ? 'Ready' : run.status} · ${shots.length} shots · ${run.sourceIds.length} sources`,
      'indigo',
      { x: 740, y: 20 },
    ),
    ...characters.map((character, index) => conceptNode(
      character.nodeId,
      character.title,
      'Character',
      character.summary,
      'mint',
      { x: 740, y: 140 + index * 120 },
    )),
    ...assets.map((asset, index) => conceptNode(
      asset.nodeId,
      asset.title,
      assetEyebrow(asset),
      asset.summary,
      asset.category === 'visual-element' ? 'indigo' : 'ink',
      { x: 740, y: 140 + (characters.length + index) * 120 },
    )),
  ];
  const shotNodes = shots.map((shot, index) => conceptNode(
    shot.nodeId,
    `${String(index + 1).padStart(2, '0')} · ${shot.title}`,
    'Shot',
    `${shot.durationSeconds}s · ${shot.framing} · ${shot.risk} risk`,
    shot.risk === 'high' ? 'indigo' : 'mint',
    { x: 1_090, y: 20 + index * 120 },
  ));
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

  return {
    version: 1,
    proposalId: `${runId}-canvas-proposal`,
    summary: `Create a validated ${shots.length}-shot prompt package with reusable continuity references.`,
    commands: [
      {
        type: 'update-node',
        id: 'story-premise',
        patch: {
          position: { x: 80, y: 330 },
          data: { body: richTextFromPlainText(scene.synopsis), eyebrow: 'Story premise', tone: 'indigo' },
        },
      },
      {
        type: 'update-node',
        id: scene.nodeId,
        patch: {
          position: { x: 400, y: 330 },
          data: {
            name: scene.title,
            label: scene.title,
            title: conceptTitleFromPlainText(scene.title),
            body: richTextFromPlainText(
              `${scene.brief?.locationPeriod ?? ''} · ${scene.brief?.genreTone ?? ''} · ${scene.brief?.targetDurationSeconds ?? 0}s · ${ceilingLabel(cinema, sceneId)}`,
            ),
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

export const compileFixtureCanvasProposal = compileCinemaCanvasProposal;
