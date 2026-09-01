import { REEL_KNOWS_TOMORROW } from './mock/reel-knows-tomorrow';
import type { CinemaProjectDataV1 } from './project-data';
import type {
  CinemaNodePresentation,
  CinemaProjectPresentation,
  PromptArtifact,
  ResearchSource,
} from './prompt-artifacts';

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function promptIdsForNode(project: CinemaProjectDataV1, nodeId: string) {
  return Object.values(project.prompts)
    .filter((prompt) => prompt.ownerNodeId === nodeId)
    .map((prompt) => prompt.id);
}

function sourceIdsForPrompts(
  project: CinemaProjectDataV1,
  promptIds: readonly string[],
) {
  return unique(promptIds.flatMap((id) => project.prompts[id]?.researchSourceIds ?? []));
}

function usageCount(project: CinemaProjectDataV1, nodeId: string) {
  return Object.values(project.shots)
    .filter((shot) => shot.continuityNodeIds.includes(nodeId))
    .length;
}

function withPromptLinks(
  project: CinemaProjectDataV1,
  detail: CinemaNodePresentation,
): CinemaNodePresentation {
  const promptIds = promptIdsForNode(project, detail.nodeId);
  return {
    ...detail,
    promptIds,
    sourceIds: sourceIdsForPrompts(project, promptIds),
  };
}

/**
 * Converts the persisted cinema domain sidecar into the read-only presentation
 * model consumed by the outline, canvas cards, and inspector. The original demo
 * supplies visual copy for fields that are not yet part of the provider contract.
 */
export function cinemaProjectPresentation(
  project: CinemaProjectDataV1,
): CinemaProjectPresentation {
  const presentation = structuredClone(REEL_KNOWS_TOMORROW);
  const scene = project.activeSceneId ? project.scenes[project.activeSceneId] : undefined;
  if (!scene) return presentation;

  const brief = scene.brief;
  const shotRecords = scene.shotIds
    .map((id) => project.shots[id])
    .filter((shot) => Boolean(shot));
  const cost = Object.values(project.costs).find((item) => item.sceneId === scene.id);
  const activeRun = Object.values(project.agentRuns)
    .filter((run) => run.sceneId === scene.id)
    .sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''))[0];

  presentation.sceneNodeId = scene.nodeId;
  presentation.targetDurationSeconds = brief?.targetDurationSeconds
    ?? shotRecords.reduce((total, shot) => total + shot.durationSeconds, 0);
  presentation.shotNodeIds = shotRecords.map((shot) => shot.nodeId);
  presentation.prompts = Object.fromEntries(Object.values(project.prompts).map((prompt) => [
    prompt.id,
    {
      id: prompt.id,
      ownerNodeId: prompt.ownerNodeId,
      label: prompt.label,
      purpose: prompt.purpose,
      providerProfile: prompt.providerProfile === 'vertex-veo' ? 'vertex-veo' : 'generic',
      generatedText: prompt.generatedText,
      negativeConstraints: [...prompt.negativeConstraints],
      continuitySourceIds: [...prompt.continuityNodeIds],
      researchSourceIds: [...prompt.researchSourceIds],
      version: prompt.version,
      status: prompt.status,
    } satisfies PromptArtifact,
  ]));
  presentation.sources = Object.fromEntries(Object.values(project.sources).map((source) => [
    source.id,
    {
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      finding: source.finding,
      status: source.status,
      isMock: source.isMock,
      url: source.url,
    } satisfies ResearchSource,
  ]));
  if (cost) {
    presentation.cost = {
      currency: cost.currency,
      minimum: cost.minimum,
      expected: cost.expected,
      highRisk: cost.highRisk,
      ceiling: cost.ceiling,
      isIllustrative: true,
      assumptions: [...cost.assumptions],
    };
  }

  const scenePromptIds = promptIdsForNode(project, scene.nodeId);
  presentation.nodes[scene.nodeId] = {
    ...(presentation.nodes[scene.nodeId] ?? REEL_KNOWS_TOMORROW.nodes['scene-01']),
    nodeId: scene.nodeId,
    title: scene.title,
    summary: scene.synopsis,
    statusLabel: scene.status === 'locked' ? 'Locked' : activeRun ? 'Plan ready' : 'Ready to plan',
    metricLabel: `${presentation.targetDurationSeconds}s${cost?.ceiling === null || cost?.ceiling === undefined
      ? ''
      : ` · ${cost.currency} ${cost.ceiling.toLocaleString('en-US')} ceiling`}`,
    fields: [
      { label: 'Tone', value: brief?.tone ?? 'Not set' },
      { label: 'Location / period', value: brief?.locationPeriod ?? 'Not set' },
      { label: 'Format', value: '9:16 vertical' },
      { label: 'Budget band', value: brief?.budgetBand ?? 'Not set' },
      { label: 'Available equipment', value: brief?.availableEquipment.join(' · ') || 'Not specified' },
    ],
    promptIds: scenePromptIds,
    sourceIds: sourceIdsForPrompts(project, scenePromptIds),
  };

  for (const character of Object.values(project.characters)) {
    const fallback = presentation.nodes[character.nodeId];
    presentation.nodes[character.nodeId] = withPromptLinks(project, {
      ...(fallback ?? {
        nodeId: character.nodeId,
        kind: 'character',
        risk: 'low',
        fields: [],
        tags: [],
        promptIds: [],
        sourceIds: [],
      }),
      nodeId: character.nodeId,
      kind: 'character',
      title: character.title,
      summary: character.summary,
      statusLabel: 'Prompt ready',
      metricLabel: `${promptIdsForNode(project, character.nodeId).length} reference prompt`,
      fields: [
        { label: 'Appearance', value: character.appearanceReference },
        { label: 'Wardrobe', value: character.wardrobeNotes },
        { label: 'Voice', value: character.voiceReference },
      ],
    });
  }

  for (const asset of Object.values(project.assets)) {
    const fallback = presentation.nodes[asset.nodeId];
    const usedBy = usageCount(project, asset.nodeId);
    presentation.nodes[asset.nodeId] = withPromptLinks(project, {
      ...(fallback ?? {
        nodeId: asset.nodeId,
        kind: 'asset',
        risk: 'low',
        fields: [],
        tags: [],
        promptIds: [],
        sourceIds: [],
      }),
      nodeId: asset.nodeId,
      kind: 'asset',
      title: asset.title,
      summary: asset.summary,
      statusLabel: asset.category.replace('-', ' '),
      metricLabel: `Used by ${usedBy} ${usedBy === 1 ? 'shot' : 'shots'}`,
      fields: [
        { label: 'Category', value: asset.category === 'visual-element' ? 'Visual element' : asset.category },
        { label: 'Continuity', value: asset.continuityNotes },
        { label: 'Provenance', value: asset.provenance },
      ],
    });
  }

  for (const shot of shotRecords) {
    const fallback = presentation.nodes[shot.nodeId];
    const promptIds = promptIdsForNode(project, shot.nodeId);
    presentation.nodes[shot.nodeId] = {
      ...(fallback ?? {
        nodeId: shot.nodeId,
        kind: 'shot',
        tags: [],
        promptIds: [],
        sourceIds: [],
      }),
      nodeId: shot.nodeId,
      kind: 'shot',
      title: shot.title,
      summary: shot.purpose,
      statusLabel: shot.generationStatus === 'planned' ? 'Prompts ready' : shot.generationStatus,
      metricLabel: `${shot.durationSeconds}s · ${shot.framing} · ${shot.risk} risk`,
      risk: shot.risk,
      fields: [
        { label: 'Duration', value: `${shot.durationSeconds}s` },
        { label: 'Framing', value: shot.framing },
        { label: 'Movement', value: shot.cameraMovement },
        { label: 'Action', value: shot.description },
        { label: 'Audio', value: shot.audio },
        {
          label: 'Dependencies',
          value: shot.continuityNodeIds
            .map((nodeId) => presentation.nodes[nodeId]?.title ?? nodeId)
            .join(' · '),
        },
      ],
      promptIds,
      sourceIds: sourceIdsForPrompts(project, promptIds),
      cost: fallback?.cost ? { ...fallback.cost, currency: cost?.currency ?? fallback.cost.currency } : undefined,
    };
  }

  if (activeRun) {
    const fallback = presentation.nodes[activeRun.nodeId];
    presentation.nodes[activeRun.nodeId] = {
      ...(fallback ?? {
        nodeId: activeRun.nodeId,
        kind: 'agent-run',
        risk: 'none',
        fields: [],
        tags: [],
        promptIds: [],
        sourceIds: [],
      }),
      nodeId: activeRun.nodeId,
      kind: 'agent-run',
      title: 'Research + Shot Planning',
      summary: activeRun.summary,
      statusLabel: activeRun.status,
      metricLabel: `${shotRecords.length} shots · ${activeRun.sourceIds.length} sources`,
      fields: [
        { label: 'Research provider', value: activeRun.researchProvider },
        { label: 'Planning provider', value: activeRun.planningProvider },
        { label: 'Model', value: activeRun.model },
      ],
      tags: activeRun.warnings.length ? ['review warnings'] : ['validated run'],
      promptIds: [...activeRun.promptIds],
      sourceIds: [...activeRun.sourceIds],
    };
  }

  const activeNodeIds = new Set([
    project.projectNodeId,
    scene.nodeId,
    ...shotRecords.map((shot) => shot.nodeId),
    ...Object.values(project.characters).map((character) => character.nodeId),
    ...Object.values(project.assets).map((asset) => asset.nodeId),
    ...Object.values(project.agentRuns).map((run) => run.nodeId),
  ].filter((id): id is string => Boolean(id)));
  presentation.nodes = Object.fromEntries(
    Object.entries(presentation.nodes).filter(([nodeId]) => activeNodeIds.has(nodeId)),
  );
  return presentation;
}
