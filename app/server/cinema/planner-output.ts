import { z } from 'zod';
import type {
  CinemaAssetRecord,
  CinemaCharacterRecord,
  CinemaCostEstimateRecord,
  CinemaProjectDataV1,
  CinemaPromptArtifactRecord,
  CinemaShotRecord,
} from '../../domain/cinema/project-data';
import type { ShotPlannerProviderRequest } from './provider-contracts';
import { ProviderError } from './provider-errors';

const shortText = z.string().trim().min(1).max(500);
const longText = z.string().trim().min(1).max(8_000);
const sourceIds = z.array(z.string().trim().min(1).max(160)).max(12);
const negativeConstraints = z.array(shortText).max(12);

export const GeneratedScenePlanSchema = z.object({
  scene: z.object({
    title: shortText,
    synopsis: longText,
    dramaticPurpose: longText,
    continuityNotes: longText,
    directionPrompt: longText,
    negativeConstraints,
    sourceIds,
  }).strict(),
  characters: z.array(z.object({
    title: shortText,
    summary: longText,
    appearanceReference: longText,
    voiceReference: longText,
    wardrobeNotes: longText,
    referencePrompt: longText,
    negativeConstraints,
    sourceIds,
  }).strict()).max(4),
  assets: z.array(z.object({
    title: shortText,
    category: z.enum(['location', 'prop', 'visual-element', 'reference', 'other']),
    summary: longText,
    continuityNotes: longText,
    referencePrompt: longText,
    negativeConstraints,
    sourceIds,
  }).strict()).min(1).max(8),
  shots: z.array(z.object({
    title: shortText,
    description: longText,
    purpose: longText,
    framing: shortText,
    cameraMovement: shortText,
    lensMm: z.number().finite().min(0.01).max(400).nullable(),
    durationSeconds: z.number().finite().min(0.01).max(180),
    audio: longText,
    risk: z.enum(['low', 'medium', 'high']),
    characterIndexes: z.array(z.number().int().nonnegative()).max(4),
    assetIndexes: z.array(z.number().int().nonnegative()).max(8),
    storyboardPrompt: longText,
    videoPrompt: longText,
    negativeConstraints,
    sourceIds,
  }).strict()).min(3).max(8),
  costAssumptions: z.array(shortText).min(1).max(12),
  warnings: z.array(shortText).max(12),
}).strict();

// Vertex accepts this intentionally lean response schema. The richer schema
// above remains the authoritative runtime boundary for lengths, counts,
// numeric ranges, and strict unknown-key rejection after generation.
const responseStringArray = z.array(z.string());
export const GeneratedScenePlanResponseSchema = z.object({
  scene: z.object({
    title: z.string(),
    synopsis: z.string(),
    dramaticPurpose: z.string(),
    continuityNotes: z.string(),
    directionPrompt: z.string(),
    negativeConstraints: responseStringArray,
    sourceIds: responseStringArray,
  }),
  characters: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    appearanceReference: z.string(),
    voiceReference: z.string(),
    wardrobeNotes: z.string(),
    referencePrompt: z.string(),
    negativeConstraints: responseStringArray,
    sourceIds: responseStringArray,
  })),
  assets: z.array(z.object({
    title: z.string(),
    category: z.enum(['location', 'prop', 'visual-element', 'reference', 'other']),
    summary: z.string(),
    continuityNotes: z.string(),
    referencePrompt: z.string(),
    negativeConstraints: responseStringArray,
    sourceIds: responseStringArray,
  })),
  shots: z.array(z.object({
    title: z.string(),
    description: z.string(),
    purpose: z.string(),
    framing: z.string(),
    cameraMovement: z.string(),
    lensMm: z.number().nullable(),
    durationSeconds: z.number(),
    audio: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    characterIndexes: z.array(z.number()),
    assetIndexes: z.array(z.number()),
    storyboardPrompt: z.string(),
    videoPrompt: z.string(),
    negativeConstraints: responseStringArray,
    sourceIds: responseStringArray,
  })),
  costAssumptions: responseStringArray,
  warnings: responseStringArray,
});

export type GeneratedScenePlan = z.infer<typeof GeneratedScenePlanSchema>;

function padded(index: number) {
  return String(index + 1).padStart(2, '0');
}

function normalizeDurations(durations: readonly number[], target: number): number[] {
  const initial = durations.map((duration) => Math.max(0.25, duration));
  const total = initial.reduce((sum, duration) => sum + duration, 0);
  const scaled = initial.map((duration) => Math.round((duration / total) * target * 100) / 100);
  const delta = Math.round((target - scaled.reduce((sum, duration) => sum + duration, 0)) * 100) / 100;
  scaled[scaled.length - 1] = Math.round((scaled[scaled.length - 1] + delta) * 100) / 100;
  if (scaled.some((duration) => duration <= 0)) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The planner returned incompatible shot durations.', true);
  }
  return scaled;
}

function checkedIndexes(indexes: readonly number[], count: number, label: string) {
  const unique = [...new Set(indexes)];
  if (unique.some((index) => index < 0 || index >= count)) {
    throw new ProviderError('UNEXPECTED_RESPONSE', `${label} contains an unresolved continuity reference.`, true);
  }
  return unique;
}

function linkedSourceIds(
  requested: readonly string[],
  available: ReadonlySet<string>,
) {
  return [...new Set(requested.filter((sourceId) => available.has(sourceId)))];
}

function calculateCost(
  request: ShotPlannerProviderRequest,
  shots: readonly CinemaShotRecord[],
  assumptions: readonly string[],
  provider: string,
  model: string,
): CinemaCostEstimateRecord {
  const budget = request.brief.generationBudget;
  const weightedSeconds = shots.reduce((total, shot) => {
    const multiplier = shot.risk === 'high' ? 1.25 : shot.risk === 'medium' ? 1.08 : 0.9;
    return total + shot.durationSeconds * multiplier;
  }, 0);
  const currencyRates = budget.currency === 'PHP'
    ? { minimum: 12, expected: 22, highRisk: 34 }
    : { minimum: 0.22, expected: 0.4, highRisk: 0.62 };
  const creditRates = { minimum: 0.6, expected: 1, highRisk: 1.5 };
  const rates = budget.pricingMode === 'credits' ? creditRates : currencyRates;
  const rounded = (value: number) => budget.currency === 'PHP'
    ? Math.round(value / 10) * 10
    : Math.round(value * 100) / 100;
  const priced = budget.pricingMode !== 'unpriced';
  return {
    id: `cost-${request.brief.sceneNodeId}`,
    runId: request.runId,
    sceneId: request.brief.sceneNodeId,
    pricingMode: budget.pricingMode,
    currency: budget.currency,
    minimum: priced ? rounded(weightedSeconds * rates.minimum) : null,
    expected: priced ? rounded(weightedSeconds * rates.expected) : null,
    highRisk: priced ? rounded(weightedSeconds * rates.highRisk) : null,
    ceiling: budget.ceiling,
    isIllustrative: true,
    assumptionProfileVersion: 1,
    provider,
    model,
    resolution: request.brief.aspectRatio,
    outputCount: shots.length,
    retryAllowance: Math.max(0, budget.maxAttempts - 1),
    pricingSnapshotDate: null,
    assumptions: [
      ...assumptions,
      priced
        ? 'Derived from planned duration and generation-risk retries; not a vendor quote.'
        : `Provider pricing is unavailable; guidance is limited to ${budget.maxAttempts} bounded attempts.`,
    ],
  };
}

export function compileGeneratedScenePlan(
  request: ShotPlannerProviderRequest,
  untrustedOutput: unknown,
  provider: string,
  model: string,
): CinemaProjectDataV1 {
  const parsed = GeneratedScenePlanSchema.safeParse(untrustedOutput);
  if (!parsed.success) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The planner returned an invalid shot-plan structure.', true, {
      cause: parsed.error,
    });
  }
  const output = parsed.data;
  const sceneId = request.brief.sceneNodeId;
  const runNodeId = 'cine-agent-plan';
  const availableSourceIds = new Set(request.research.sources.map((source) => source.id));
  const characters: Record<string, CinemaCharacterRecord> = {};
  const assets: Record<string, CinemaAssetRecord> = {};
  const prompts: Record<string, CinemaPromptArtifactRecord> = {};

  const addPrompt = (prompt: CinemaPromptArtifactRecord) => {
    prompts[prompt.id] = prompt;
  };
  const characterNodeIds = output.characters.map((character, index) => {
    const nodeId = `cine-character-${padded(index)}`;
    characters[nodeId] = {
      id: nodeId,
      nodeId,
      sceneIds: [sceneId],
      title: character.title,
      summary: character.summary,
      appearanceReference: character.appearanceReference,
      voiceReference: character.voiceReference,
      wardrobeNotes: character.wardrobeNotes,
    };
    addPrompt({
      id: `prompt-${nodeId}-reference`,
      ownerNodeId: nodeId,
      runId: request.runId,
      label: 'Character reference sheet',
      purpose: 'reference-sheet',
      providerProfile: 'generic',
      generatedText: character.referencePrompt,
      negativeConstraints: [...character.negativeConstraints],
      continuityNodeIds: [],
      researchSourceIds: linkedSourceIds(character.sourceIds, availableSourceIds),
      version: 1,
      status: 'draft',
    });
    return nodeId;
  });
  const assetNodeIds = output.assets.map((asset, index) => {
    const nodeId = `cine-asset-${padded(index)}`;
    const linkedSources = linkedSourceIds(asset.sourceIds, availableSourceIds);
    assets[nodeId] = {
      id: nodeId,
      nodeId,
      sceneIds: [sceneId],
      title: asset.title,
      category: asset.category,
      summary: asset.summary,
      continuityNotes: asset.continuityNotes,
      source: 'planned',
      uri: '',
      provenance: linkedSources.length
        ? `Planned from ${linkedSources.length} cited research ${linkedSources.length === 1 ? 'source' : 'sources'}.`
        : 'Derived from the creator scene brief without an external source.',
    };
    addPrompt({
      id: `prompt-${nodeId}-reference`,
      ownerNodeId: nodeId,
      runId: request.runId,
      label: `${asset.category === 'location' ? 'Location' : 'Asset'} reference`,
      purpose: 'reference-sheet',
      providerProfile: 'generic',
      generatedText: asset.referencePrompt,
      negativeConstraints: [...asset.negativeConstraints],
      continuityNodeIds: [],
      researchSourceIds: linkedSources,
      version: 1,
      status: 'draft',
    });
    return nodeId;
  });

  addPrompt({
    id: 'prompt-scene-direction',
    ownerNodeId: sceneId,
    runId: request.runId,
    label: 'Scene direction',
    purpose: 'scene-direction',
    providerProfile: 'generic',
    generatedText: output.scene.directionPrompt,
    negativeConstraints: [...output.scene.negativeConstraints],
    continuityNodeIds: [],
    researchSourceIds: linkedSourceIds(output.scene.sourceIds, availableSourceIds),
    version: 1,
    status: 'draft',
  });

  const durations = normalizeDurations(
    output.shots.map((shot) => shot.durationSeconds),
    request.brief.targetDurationSeconds,
  );
  const shots: Record<string, CinemaShotRecord> = {};
  const shotIds = output.shots.map((shot, index) => {
    const nodeId = `cine-shot-${padded(index)}`;
    const continuityNodeIds = [
      ...checkedIndexes(shot.characterIndexes, characterNodeIds.length, `Shot ${index + 1}`)
        .map((dependencyIndex) => characterNodeIds[dependencyIndex]),
      ...checkedIndexes(shot.assetIndexes, assetNodeIds.length, `Shot ${index + 1}`)
        .map((dependencyIndex) => assetNodeIds[dependencyIndex]),
    ];
    const linkedSources = linkedSourceIds(shot.sourceIds, availableSourceIds);
    shots[nodeId] = {
      id: nodeId,
      nodeId,
      sceneId,
      order: index + 1,
      title: shot.title,
      description: shot.description,
      purpose: shot.purpose,
      framing: shot.framing,
      cameraMovement: shot.cameraMovement,
      lensMm: shot.lensMm,
      durationSeconds: durations[index],
      audio: shot.audio,
      risk: shot.risk,
      continuityNodeIds,
      generationStatus: 'planned',
    };
    addPrompt({
      id: `prompt-${nodeId}-storyboard`,
      ownerNodeId: nodeId,
      runId: request.runId,
      label: 'Storyboard prompt',
      purpose: 'storyboard',
      providerProfile: 'generic',
      generatedText: shot.storyboardPrompt,
      negativeConstraints: [...shot.negativeConstraints],
      continuityNodeIds,
      researchSourceIds: linkedSources,
      version: 1,
      status: 'draft',
    });
    addPrompt({
      id: `prompt-${nodeId}-video`,
      ownerNodeId: nodeId,
      runId: request.runId,
      label: 'Video prompt',
      purpose: 'video',
      providerProfile: 'vertex-veo',
      generatedText: shot.videoPrompt,
      negativeConstraints: [...shot.negativeConstraints],
      continuityNodeIds,
      researchSourceIds: linkedSources,
      version: 1,
      status: 'draft',
    });
    return nodeId;
  });
  const cost = calculateCost(request, Object.values(shots), output.costAssumptions, provider, model);
  const warnings = [...new Set([
    ...request.research.warnings,
    ...output.warnings,
    ...(request.research.sources.length ? [] : ['The proposal has limited research and no external citations.']),
    ...(cost.ceiling !== null && cost.expected !== null && cost.expected > cost.ceiling
      ? ['The expected generation estimate exceeds the confirmed ceiling.']
      : []),
  ])];
  const proposedCommandCount = 3 + 2 * (1 + characterNodeIds.length + assetNodeIds.length + shotIds.length);

  return {
    schemaVersion: 1,
    projectNodeId: 'story-premise',
    activeSceneId: sceneId,
    sceneOrder: [sceneId],
    scenes: {
      [sceneId]: {
        id: sceneId,
        nodeId: sceneId,
        title: output.scene.title,
        synopsis: output.scene.synopsis,
        dramaticPurpose: output.scene.dramaticPurpose,
        status: 'draft',
        continuityNotes: output.scene.continuityNotes,
        brief: {
          version: 2,
          creationMode: request.brief.creationMode,
          aspectRatio: request.brief.aspectRatio,
          targetPlatform: request.brief.targetPlatform,
          genreTone: request.brief.genreTone,
          locationPeriod: request.brief.locationPeriod,
          dialogueAudioIntent: request.brief.dialogueAudioIntent,
          targetDurationSeconds: request.brief.targetDurationSeconds,
          requiredBeats: [...request.brief.requiredBeats],
          mustInclude: [...request.brief.mustInclude],
          mustAvoid: [...request.brief.mustAvoid],
          generationBudget: structuredClone(request.brief.generationBudget),
          productionConstraints: structuredClone(request.brief.productionConstraints),
        },
        shotIds,
      },
    },
    shots,
    characters,
    assets,
    agentRuns: {
      [request.runId]: {
        id: request.runId,
        nodeId: runNodeId,
        sceneId,
        status: 'ready',
        summary: `Cited research and structured planning produced ${shotIds.length} shots.`,
        proposedCommandCount,
        researchProvider: request.research.provider,
        planningProvider: provider,
        model,
        sourceIds: request.research.sources.map((source) => source.id),
        promptIds: Object.keys(prompts),
        warnings,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
    },
    prompts,
    sources: Object.fromEntries(request.research.sources.map((source) => [source.id, source])),
    costs: { [cost.id]: cost },
  };
}
