export type CinemaCurrency = 'PHP' | 'USD';
export type CinemaRisk = 'none' | 'low' | 'medium' | 'high';
export type CinemaBudgetBand = 'micro' | 'lean' | 'indie' | 'custom';
export type CinemaPromptPurpose = 'scene-direction' | 'reference-sheet' | 'storyboard' | 'video';
export type CinemaRunStatus =
  | 'draft'
  | 'researching'
  | 'planning'
  | 'validating'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'rejected'
  | 'accepted';

export type CinemaSceneBrief = {
  tone: string;
  locationPeriod: string;
  budgetBand: CinemaBudgetBand;
  currency: CinemaCurrency;
  budgetCeiling: number | null;
  targetDurationSeconds: number;
  availableEquipment: string[];
};

export type CinemaSceneRecord = {
  id: string;
  nodeId: string;
  title: string;
  synopsis: string;
  dramaticPurpose: string;
  status: 'outline' | 'draft' | 'locked';
  continuityNotes: string;
  brief: CinemaSceneBrief | null;
  shotIds: string[];
};

export type CinemaShotRecord = {
  id: string;
  nodeId: string;
  sceneId: string;
  order: number;
  title: string;
  description: string;
  purpose: string;
  framing: string;
  cameraMovement: string;
  lensMm: number | null;
  durationSeconds: number;
  audio: string;
  risk: Exclude<CinemaRisk, 'none'>;
  continuityNodeIds: string[];
  generationStatus: 'not-requested' | 'planned' | 'ready' | 'failed';
};

export type CinemaCharacterRecord = {
  id: string;
  nodeId: string;
  sceneIds: string[];
  title: string;
  summary: string;
  appearanceReference: string;
  voiceReference: string;
  wardrobeNotes: string;
};

export type CinemaAssetRecord = {
  id: string;
  nodeId: string;
  sceneIds: string[];
  title: string;
  category: 'location' | 'prop' | 'visual-element' | 'reference' | 'other';
  summary: string;
  continuityNotes: string;
  source: 'local' | 'generated' | 'external' | 'planned';
  uri: string;
  provenance: string;
};

export type CinemaAgentRunRecord = {
  id: string;
  nodeId: string;
  sceneId: string;
  status: CinemaRunStatus;
  summary: string;
  proposedCommandCount: number;
  researchProvider: string;
  planningProvider: string;
  model: string;
  sourceIds: string[];
  promptIds: string[];
  warnings: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type CinemaPromptArtifactRecord = {
  id: string;
  ownerNodeId: string;
  runId: string;
  label: string;
  purpose: CinemaPromptPurpose;
  providerProfile: string;
  generatedText: string;
  negativeConstraints: string[];
  continuityNodeIds: string[];
  researchSourceIds: string[];
  version: number;
  status: 'draft' | 'approved';
};

export type CinemaResearchSourceRecord = {
  id: string;
  runId: string;
  title: string;
  publisher: string;
  url: string | null;
  finding: string;
  queryPurpose: string;
  status: 'pinned' | 'suggested';
  isMock: boolean;
  retrievedAt: string;
};

export type CinemaCostEstimateRecord = {
  id: string;
  runId: string;
  sceneId: string;
  currency: CinemaCurrency;
  minimum: number;
  expected: number;
  highRisk: number;
  ceiling: number | null;
  isIllustrative: true;
  assumptions: string[];
};

export type CinemaProjectDataV1 = {
  schemaVersion: 1;
  projectNodeId: string | null;
  activeSceneId: string | null;
  sceneOrder: string[];
  scenes: Record<string, CinemaSceneRecord>;
  shots: Record<string, CinemaShotRecord>;
  characters: Record<string, CinemaCharacterRecord>;
  assets: Record<string, CinemaAssetRecord>;
  agentRuns: Record<string, CinemaAgentRunRecord>;
  prompts: Record<string, CinemaPromptArtifactRecord>;
  sources: Record<string, CinemaResearchSourceRecord>;
  costs: Record<string, CinemaCostEstimateRecord>;
} & { [key: `x-${string}`]: JsonValue | undefined };

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const MAX_RECORDS = 2_500;
const MAX_TEXT = 20_000;
const MAX_SHORT_TEXT = 500;
const MAX_LIST = 500;
const MAX_EXTENSION_DEPTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, max = MAX_TEXT): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid or too long.`);
  return value;
}

function id(value: unknown, label: string): string {
  const result = text(value, label, 160);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const result = finiteNonNegative(value, label);
  if (result <= 0) throw new Error(`${label} must be greater than zero.`);
  return result;
}

function integer(value: unknown, label: string): number {
  const result = finiteNonNegative(value, label);
  if (!Number.isInteger(result)) throw new Error(`${label} must be a whole number.`);
  return result;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : finiteNonNegative(value, label);
}

function nullableIsoDate(value: unknown, label: string): string | null {
  if (value === null) return null;
  const result = text(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} must be an ISO date.`);
  return result;
}

function isoDate(value: unknown, label: string): string {
  const result = nullableIsoDate(value, label);
  if (result === null) throw new Error(`${label} is required.`);
  return result;
}

function stringList(value: unknown, label: string, maxItems = MAX_LIST): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} is invalid or too long.`);
  return value.map((item, index) => text(item, `${label} item ${index + 1}`, MAX_SHORT_TEXT));
}

function idList(value: unknown, label: string): string[] {
  const result = stringList(value, label).map((item, index) => id(item, `${label} item ${index + 1}`));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate ids.`);
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} is unsupported.`);
  return value as T;
}

function jsonValue(value: unknown, depth = 0): JsonValue {
  if (depth > MAX_EXTENSION_DEPTH) throw new Error('Cinema extension data is too deeply nested.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => jsonValue(item, depth + 1));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item, depth + 1)]));
  }
  throw new Error('Cinema extension data must be JSON-compatible.');
}

function extensions(value: Record<string, unknown>): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.startsWith('x-'))
      .map(([key, item]) => [key, jsonValue(item)]),
  );
}

function recordMap<T>(
  value: unknown,
  label: string,
  parse: (record: Record<string, unknown>, key: string) => T & { id: string },
): Record<string, T> {
  if (!isRecord(value) || Object.keys(value).length > MAX_RECORDS) throw new Error(`${label} is invalid or too large.`);
  return Object.fromEntries(Object.entries(value).map(([key, raw]) => {
    if (!isRecord(raw)) throw new Error(`${label} ${key} is invalid.`);
    const parsed = parse(raw, key);
    if (parsed.id !== key) throw new Error(`${label} key ${key} does not match its id.`);
    return [key, parsed];
  }));
}

function sceneBrief(value: unknown): CinemaSceneBrief | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('Scene brief is invalid.');
  return {
    ...extensions(value),
    tone: text(value.tone, 'Scene tone', MAX_SHORT_TEXT),
    locationPeriod: text(value.locationPeriod, 'Scene location and period', MAX_SHORT_TEXT),
    budgetBand: oneOf(value.budgetBand, ['micro', 'lean', 'indie', 'custom'], 'Budget band'),
    currency: oneOf(value.currency, ['PHP', 'USD'], 'Budget currency'),
    budgetCeiling: nullableNumber(value.budgetCeiling, 'Budget ceiling'),
    targetDurationSeconds: positive(value.targetDurationSeconds, 'Target duration'),
    availableEquipment: stringList(value.availableEquipment, 'Available equipment', 100),
  };
}

function requireHost(hostNodeIds: ReadonlySet<string>, nodeId: string, label: string) {
  if (!hostNodeIds.has(nodeId)) throw new Error(`${label} refers to missing canvas node ${nodeId}.`);
}

function requireReference<T>(records: Record<string, T>, referenceId: string, label: string) {
  if (!records[referenceId]) throw new Error(`${label} refers to missing id ${referenceId}.`);
}

export function createEmptyCinemaProjectData(): CinemaProjectDataV1 {
  return {
    schemaVersion: 1,
    projectNodeId: null,
    activeSceneId: null,
    sceneOrder: [],
    scenes: {},
    shots: {},
    characters: {},
    assets: {},
    agentRuns: {},
    prompts: {},
    sources: {},
    costs: {},
  };
}

export function validateCinemaProjectData(
  value: unknown,
  hostNodeIds: ReadonlySet<string>,
): CinemaProjectDataV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error('This project uses an unsupported cinema data version.');
  }

  const scenes = recordMap(value.scenes, 'Scene', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Scene id'),
    nodeId: id(record.nodeId, 'Scene canvas node id'),
    title: text(record.title, 'Scene title', MAX_SHORT_TEXT),
    synopsis: text(record.synopsis, 'Scene synopsis'),
    dramaticPurpose: text(record.dramaticPurpose, 'Scene dramatic purpose'),
    status: oneOf(record.status, ['outline', 'draft', 'locked'], 'Scene status'),
    continuityNotes: text(record.continuityNotes, 'Scene continuity notes'),
    brief: sceneBrief(record.brief),
    shotIds: idList(record.shotIds, 'Scene shot ids'),
  }));
  const shots = recordMap(value.shots, 'Shot', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Shot id'),
    nodeId: id(record.nodeId, 'Shot canvas node id'),
    sceneId: id(record.sceneId, 'Shot scene id'),
    order: integer(record.order, 'Shot order'),
    title: text(record.title, 'Shot title', MAX_SHORT_TEXT),
    description: text(record.description, 'Shot description'),
    purpose: text(record.purpose, 'Shot purpose'),
    framing: text(record.framing, 'Shot framing', MAX_SHORT_TEXT),
    cameraMovement: text(record.cameraMovement, 'Shot camera movement', MAX_SHORT_TEXT),
    lensMm: nullableNumber(record.lensMm, 'Shot lens'),
    durationSeconds: positive(record.durationSeconds, 'Shot duration'),
    audio: text(record.audio, 'Shot audio'),
    risk: oneOf(record.risk, ['low', 'medium', 'high'], 'Shot risk'),
    continuityNodeIds: idList(record.continuityNodeIds, 'Shot continuity node ids'),
    generationStatus: oneOf(
      record.generationStatus,
      ['not-requested', 'planned', 'ready', 'failed'],
      'Shot generation status',
    ),
  }));
  const characters = recordMap(value.characters, 'Character', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Character id'),
    nodeId: id(record.nodeId, 'Character canvas node id'),
    sceneIds: idList(record.sceneIds, 'Character scene ids'),
    title: text(record.title, 'Character title', MAX_SHORT_TEXT),
    summary: text(record.summary, 'Character summary'),
    appearanceReference: text(record.appearanceReference, 'Character appearance reference'),
    voiceReference: text(record.voiceReference, 'Character voice reference'),
    wardrobeNotes: text(record.wardrobeNotes, 'Character wardrobe notes'),
  }));
  const assets = recordMap(value.assets, 'Asset', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Asset id'),
    nodeId: id(record.nodeId, 'Asset canvas node id'),
    sceneIds: idList(record.sceneIds, 'Asset scene ids'),
    title: text(record.title, 'Asset title', MAX_SHORT_TEXT),
    category: oneOf(
      record.category,
      ['location', 'prop', 'visual-element', 'reference', 'other'],
      'Asset category',
    ),
    summary: text(record.summary, 'Asset summary'),
    continuityNotes: text(record.continuityNotes, 'Asset continuity notes'),
    source: oneOf(record.source, ['local', 'generated', 'external', 'planned'], 'Asset source'),
    uri: text(record.uri, 'Asset URI', 4_000),
    provenance: text(record.provenance, 'Asset provenance'),
  }));
  const agentRuns = recordMap(value.agentRuns, 'Agent run', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Agent run id'),
    nodeId: id(record.nodeId, 'Agent run canvas node id'),
    sceneId: id(record.sceneId, 'Agent run scene id'),
    status: oneOf(
      record.status,
      ['draft', 'researching', 'planning', 'validating', 'ready', 'failed', 'cancelled', 'rejected', 'accepted'],
      'Agent run status',
    ),
    summary: text(record.summary, 'Agent run summary'),
    proposedCommandCount: integer(record.proposedCommandCount, 'Proposed command count'),
    researchProvider: text(record.researchProvider, 'Research provider', MAX_SHORT_TEXT),
    planningProvider: text(record.planningProvider, 'Planning provider', MAX_SHORT_TEXT),
    model: text(record.model, 'Planning model', MAX_SHORT_TEXT),
    sourceIds: idList(record.sourceIds, 'Agent run source ids'),
    promptIds: idList(record.promptIds, 'Agent run prompt ids'),
    warnings: stringList(record.warnings, 'Agent run warnings'),
    startedAt: nullableIsoDate(record.startedAt, 'Agent run start'),
    completedAt: nullableIsoDate(record.completedAt, 'Agent run completion'),
  }));
  const prompts = recordMap(value.prompts, 'Prompt', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Prompt id'),
    ownerNodeId: id(record.ownerNodeId, 'Prompt owner canvas node id'),
    runId: id(record.runId, 'Prompt run id'),
    label: text(record.label, 'Prompt label', MAX_SHORT_TEXT),
    purpose: oneOf(record.purpose, ['scene-direction', 'reference-sheet', 'storyboard', 'video'], 'Prompt purpose'),
    providerProfile: text(record.providerProfile, 'Prompt provider profile', MAX_SHORT_TEXT),
    generatedText: text(record.generatedText, 'Generated prompt'),
    negativeConstraints: stringList(record.negativeConstraints, 'Prompt negative constraints'),
    continuityNodeIds: idList(record.continuityNodeIds, 'Prompt continuity node ids'),
    researchSourceIds: idList(record.researchSourceIds, 'Prompt research source ids'),
    version: integer(record.version, 'Prompt version'),
    status: oneOf(record.status, ['draft', 'approved'], 'Prompt status'),
  }));
  const sources = recordMap(value.sources, 'Research source', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Research source id'),
    runId: id(record.runId, 'Research source run id'),
    title: text(record.title, 'Research source title', MAX_SHORT_TEXT),
    publisher: text(record.publisher, 'Research source publisher', MAX_SHORT_TEXT),
    url: record.url === null ? null : text(record.url, 'Research source URL', 4_000),
    finding: text(record.finding, 'Research finding'),
    queryPurpose: text(record.queryPurpose, 'Research query purpose', MAX_SHORT_TEXT),
    status: oneOf(record.status, ['pinned', 'suggested'], 'Research source status'),
    isMock: record.isMock === true,
    retrievedAt: isoDate(record.retrievedAt, 'Research retrieval time'),
  }));
  const costs = recordMap(value.costs, 'Cost estimate', (record) => ({
    ...extensions(record),
    id: id(record.id, 'Cost estimate id'),
    runId: id(record.runId, 'Cost estimate run id'),
    sceneId: id(record.sceneId, 'Cost estimate scene id'),
    currency: oneOf(record.currency, ['PHP', 'USD'], 'Cost currency'),
    minimum: finiteNonNegative(record.minimum, 'Minimum cost'),
    expected: finiteNonNegative(record.expected, 'Expected cost'),
    highRisk: finiteNonNegative(record.highRisk, 'High-risk cost'),
    ceiling: nullableNumber(record.ceiling, 'Cost ceiling'),
    isIllustrative: true as const,
    assumptions: stringList(record.assumptions, 'Cost assumptions'),
  }));

  const projectNodeId = value.projectNodeId === null ? null : id(value.projectNodeId, 'Project canvas node id');
  const activeSceneId = value.activeSceneId === null ? null : id(value.activeSceneId, 'Active scene id');
  const sceneOrder = idList(value.sceneOrder, 'Scene order');
  if (projectNodeId !== null) requireHost(hostNodeIds, projectNodeId, 'Cinema project');
  if (activeSceneId !== null) requireReference(scenes, activeSceneId, 'Active scene');
  if (sceneOrder.length !== Object.keys(scenes).length || sceneOrder.some((sceneId) => !scenes[sceneId])) {
    throw new Error('Scene order must contain every scene exactly once.');
  }

  for (const scene of Object.values(scenes)) {
    requireHost(hostNodeIds, scene.nodeId, `Scene ${scene.id}`);
    const expectedShots = Object.values(shots)
      .filter((shot) => shot.sceneId === scene.id)
      .sort((left, right) => left.order - right.order)
      .map((shot) => shot.id);
    if (new Set(expectedShots.map((shotId) => shots[shotId].order)).size !== expectedShots.length) {
      throw new Error(`Scene ${scene.id} contains duplicate shot orders.`);
    }
    if (scene.shotIds.length !== expectedShots.length || scene.shotIds.some((shotId, index) => shotId !== expectedShots[index])) {
      throw new Error(`Scene ${scene.id} shot ids must match its chronological shots.`);
    }
  }
  for (const shot of Object.values(shots)) {
    requireHost(hostNodeIds, shot.nodeId, `Shot ${shot.id}`);
    requireReference(scenes, shot.sceneId, `Shot ${shot.id}`);
    for (const nodeId of shot.continuityNodeIds) {
      const resolved = Object.values(characters).some((record) => record.nodeId === nodeId)
        || Object.values(assets).some((record) => record.nodeId === nodeId);
      if (!resolved) throw new Error(`Shot ${shot.id} refers to missing continuity node ${nodeId}.`);
    }
  }
  for (const character of Object.values(characters)) {
    requireHost(hostNodeIds, character.nodeId, `Character ${character.id}`);
    character.sceneIds.forEach((sceneId) => requireReference(scenes, sceneId, `Character ${character.id}`));
  }
  for (const asset of Object.values(assets)) {
    requireHost(hostNodeIds, asset.nodeId, `Asset ${asset.id}`);
    asset.sceneIds.forEach((sceneId) => requireReference(scenes, sceneId, `Asset ${asset.id}`));
  }
  for (const run of Object.values(agentRuns)) {
    requireHost(hostNodeIds, run.nodeId, `Agent run ${run.id}`);
    requireReference(scenes, run.sceneId, `Agent run ${run.id}`);
    run.sourceIds.forEach((sourceId) => requireReference(sources, sourceId, `Agent run ${run.id}`));
    run.promptIds.forEach((promptId) => requireReference(prompts, promptId, `Agent run ${run.id}`));
  }
  for (const prompt of Object.values(prompts)) {
    requireHost(hostNodeIds, prompt.ownerNodeId, `Prompt ${prompt.id}`);
    requireReference(agentRuns, prompt.runId, `Prompt ${prompt.id}`);
    prompt.researchSourceIds.forEach((sourceId) => requireReference(sources, sourceId, `Prompt ${prompt.id}`));
    for (const nodeId of prompt.continuityNodeIds) {
      if (!hostNodeIds.has(nodeId)) throw new Error(`Prompt ${prompt.id} refers to missing continuity node ${nodeId}.`);
    }
  }
  for (const source of Object.values(sources)) requireReference(agentRuns, source.runId, `Research source ${source.id}`);
  for (const cost of Object.values(costs)) {
    requireReference(agentRuns, cost.runId, `Cost estimate ${cost.id}`);
    requireReference(scenes, cost.sceneId, `Cost estimate ${cost.id}`);
    if (cost.minimum > cost.expected || cost.expected > cost.highRisk) {
      throw new Error(`Cost estimate ${cost.id} ranges are out of order.`);
    }
    if (cost.ceiling !== null && cost.highRisk > cost.ceiling) {
      throw new Error(`Cost estimate ${cost.id} exceeds its ceiling.`);
    }
  }

  return {
    ...extensions(value),
    schemaVersion: 1,
    projectNodeId,
    activeSceneId,
    sceneOrder,
    scenes,
    shots,
    characters,
    assets,
    agentRuns,
    prompts,
    sources,
    costs,
  };
}

export function removeCinemaRecordsForNodes(
  project: CinemaProjectDataV1,
  removedNodeIds: ReadonlySet<string>,
  remainingHostNodeIds: ReadonlySet<string>,
): CinemaProjectDataV1 {
  if (!removedNodeIds.size) return project;
  const next = structuredClone(project);
  if (next.projectNodeId !== null && removedNodeIds.has(next.projectNodeId)) next.projectNodeId = null;

  const removedSceneIds = new Set(Object.values(next.scenes)
    .filter((record) => removedNodeIds.has(record.nodeId))
    .map((record) => record.id));
  const removedShotIds = new Set(Object.values(next.shots)
    .filter((record) => removedNodeIds.has(record.nodeId) || removedSceneIds.has(record.sceneId))
    .map((record) => record.id));
  const removedCharacterIds = new Set(Object.values(next.characters)
    .filter((record) => removedNodeIds.has(record.nodeId))
    .map((record) => record.id));
  const removedAssetIds = new Set(Object.values(next.assets)
    .filter((record) => removedNodeIds.has(record.nodeId))
    .map((record) => record.id));
  const removedRunIds = new Set(Object.values(next.agentRuns)
    .filter((record) => removedNodeIds.has(record.nodeId) || removedSceneIds.has(record.sceneId))
    .map((record) => record.id));

  for (const sceneId of removedSceneIds) delete next.scenes[sceneId];
  for (const shotId of removedShotIds) delete next.shots[shotId];
  for (const characterId of removedCharacterIds) delete next.characters[characterId];
  for (const assetId of removedAssetIds) delete next.assets[assetId];
  for (const runId of removedRunIds) delete next.agentRuns[runId];

  next.sceneOrder = next.sceneOrder.filter((sceneId) => !removedSceneIds.has(sceneId));
  if (next.activeSceneId !== null && removedSceneIds.has(next.activeSceneId)) {
    next.activeSceneId = next.sceneOrder[0] ?? null;
  }
  for (const scene of Object.values(next.scenes)) {
    scene.shotIds = scene.shotIds.filter((shotId) => !removedShotIds.has(shotId));
  }
  for (const character of Object.values(next.characters)) {
    character.sceneIds = character.sceneIds.filter((sceneId) => !removedSceneIds.has(sceneId));
  }
  for (const asset of Object.values(next.assets)) {
    asset.sceneIds = asset.sceneIds.filter((sceneId) => !removedSceneIds.has(sceneId));
  }

  const removedContinuityNodeIds = new Set<string>();
  for (const record of Object.values(project.characters)) {
    if (removedCharacterIds.has(record.id)) removedContinuityNodeIds.add(record.nodeId);
  }
  for (const record of Object.values(project.assets)) {
    if (removedAssetIds.has(record.id)) removedContinuityNodeIds.add(record.nodeId);
  }
  for (const shot of Object.values(next.shots)) {
    shot.continuityNodeIds = shot.continuityNodeIds.filter((nodeId) => !removedContinuityNodeIds.has(nodeId));
  }

  const removedSourceIds = new Set(Object.values(next.sources)
    .filter((source) => removedRunIds.has(source.runId))
    .map((source) => source.id));
  for (const sourceId of removedSourceIds) delete next.sources[sourceId];
  for (const [promptId, prompt] of Object.entries(next.prompts)) {
    if (
      removedRunIds.has(prompt.runId)
      || removedNodeIds.has(prompt.ownerNodeId)
      || removedShotIds.has(prompt.ownerNodeId)
    ) {
      delete next.prompts[promptId];
      continue;
    }
    prompt.continuityNodeIds = prompt.continuityNodeIds
      .filter((nodeId) => !removedContinuityNodeIds.has(nodeId));
    prompt.researchSourceIds = prompt.researchSourceIds
      .filter((sourceId) => !removedSourceIds.has(sourceId));
  }
  for (const [costId, cost] of Object.entries(next.costs)) {
    if (removedRunIds.has(cost.runId) || removedSceneIds.has(cost.sceneId)) delete next.costs[costId];
  }
  for (const run of Object.values(next.agentRuns)) {
    run.sourceIds = run.sourceIds.filter((sourceId) => !removedSourceIds.has(sourceId));
    run.promptIds = run.promptIds.filter((promptId) => Boolean(next.prompts[promptId]));
  }

  return validateCinemaProjectData(next, remainingHostNodeIds);
}
