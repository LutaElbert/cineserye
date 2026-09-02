export type CinemaCurrency = 'PHP' | 'USD';
export type CinemaRisk = 'none' | 'low' | 'medium' | 'high';
export type CinemaBudgetBand = 'micro' | 'lean' | 'indie' | 'custom';
export type CinemaCreationMode = 'ai-generated' | 'live-action' | 'hybrid';
export type CinemaAspectRatio = '9:16' | '16:9' | '1:1' | '4:5';
export type CinemaTargetPlatform = 'short-form' | 'youtube' | 'film-festival' | 'commercial' | 'other';
export type CinemaDialogueAudioIntent = 'dialogue-led' | 'music-led' | 'sound-design-led' | 'silent' | 'mixed';
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

export type CinemaGenerationBudget = {
  pricingMode: 'unpriced' | 'credits' | 'currency';
  currency: CinemaCurrency | null;
  ceiling: number | null;
  maxAttempts: number;
};

export type CinemaProductionConstraints = {
  budgetBand: CinemaBudgetBand;
  currency: CinemaCurrency;
  budgetCeiling: number | null;
  availableEquipment: string[];
};

export type CinemaSceneBrief = {
  version: 2;
  creationMode: CinemaCreationMode;
  aspectRatio: CinemaAspectRatio;
  targetPlatform: CinemaTargetPlatform;
  genreTone: string;
  locationPeriod: string;
  dialogueAudioIntent: CinemaDialogueAudioIntent;
  targetDurationSeconds: number;
  requiredBeats: string[];
  mustInclude: string[];
  mustAvoid: string[];
  generationBudget: CinemaGenerationBudget;
  productionConstraints: CinemaProductionConstraints;
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
  referenceIds?: string[];
  version: number;
  status: 'draft' | 'stale' | 'approved';
};

export type CinemaResearchSourceRecord = {
  id: string;
  runId: string;
  title: string;
  publisher: string;
  url: string | null;
  finding: string;
  queryPurpose: string;
  status: 'supported' | 'needs-verification' | 'irrelevant';
  creatorPinned: boolean;
  isMock: boolean;
  retrievedAt: string;
};

export type CinemaCostEstimateRecord = {
  id: string;
  runId: string;
  sceneId: string;
  pricingMode: 'unpriced' | 'credits' | 'currency';
  currency: CinemaCurrency | null;
  minimum: number | null;
  expected: number | null;
  highRisk: number | null;
  ceiling: number | null;
  isIllustrative: true;
  assumptionProfileVersion: 1;
  provider: string;
  model: string;
  resolution: string;
  outputCount: number;
  retryAllowance: number;
  pricingSnapshotDate: string | null;
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

export type CinemaRevisionSnapshot = {
  scene: CinemaSceneRecord;
  shots: Record<string, CinemaShotRecord>;
  characters: Record<string, CinemaCharacterRecord>;
  assets: Record<string, CinemaAssetRecord>;
  agentRuns: Record<string, CinemaAgentRunRecord>;
  prompts: Record<string, CinemaPromptArtifactRecord>;
  sources: Record<string, CinemaResearchSourceRecord>;
  costs: Record<string, CinemaCostEstimateRecord>;
};

export type CinemaPlanRevisionRecord = {
  id: string;
  sceneId: string;
  number: number;
  runId: string;
  predecessorRevisionId: string | null;
  status: 'active' | 'superseded';
  summary: string;
  createdAt: string;
  acceptedAt: string;
  snapshot: CinemaRevisionSnapshot;
};

export type CinemaProjectData = Omit<CinemaProjectDataV1, 'schemaVersion'> & {
  schemaVersion: 2;
  projectId: string;
  activeRevisionId: string | null;
  revisions: Record<string, CinemaPlanRevisionRecord>;
  visualPreproduction?: import('./visual-preproduction').CinemaVisualPreproductionData;
  professionalPlanning?: import('./professional-planning').CinemaProfessionalPlanningData;
  multiScene?: import('./multi-scene').CinemaMultiSceneData;
};

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

function positiveInteger(value: unknown, label: string): number {
  const result = integer(value, label);
  if (result <= 0) throw new Error(`${label} must be greater than zero.`);
  return result;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : finiteNonNegative(value, label);
}

function nullablePositive(value: unknown, label: string): number | null {
  return value === null ? null : positive(value, label);
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
  if (value.version === undefined || value.version === 1) {
    const currency = oneOf(value.currency, ['PHP', 'USD'], 'Budget currency');
    return {
      ...extensions(value),
      version: 2,
      creationMode: 'ai-generated',
      aspectRatio: '9:16',
      targetPlatform: 'short-form',
      genreTone: text(value.tone, 'Scene tone', MAX_SHORT_TEXT),
      locationPeriod: text(value.locationPeriod, 'Scene location and period', MAX_SHORT_TEXT),
      dialogueAudioIntent: 'mixed',
      targetDurationSeconds: positive(value.targetDurationSeconds, 'Target duration'),
      requiredBeats: [],
      mustInclude: [],
      mustAvoid: [],
      generationBudget: {
        pricingMode: 'currency',
        currency,
        ceiling: nullableNumber(value.budgetCeiling, 'Generation budget ceiling'),
        maxAttempts: 2,
      },
      productionConstraints: {
        budgetBand: oneOf(value.budgetBand, ['micro', 'lean', 'indie', 'custom'], 'Budget band'),
        currency,
        budgetCeiling: null,
        availableEquipment: stringList(value.availableEquipment, 'Available equipment', 100),
      },
    };
  }
  if (value.version !== 2 || !isRecord(value.generationBudget) || !isRecord(value.productionConstraints)) {
    throw new Error('This scene brief version is unsupported.');
  }
  const pricingMode = oneOf(
    value.generationBudget.pricingMode,
    ['unpriced', 'credits', 'currency'],
    'Generation pricing mode',
  );
  const generationCurrency = value.generationBudget.currency === null
    ? null
    : oneOf(value.generationBudget.currency, ['PHP', 'USD'], 'Generation budget currency');
  const generationCeiling = nullablePositive(value.generationBudget.ceiling, 'Generation budget ceiling');
  const maxAttempts = integer(value.generationBudget.maxAttempts, 'Generation attempts');
  if (maxAttempts < 1 || maxAttempts > 20) throw new Error('Generation attempts must be between 1 and 20.');
  if (pricingMode === 'currency' && generationCurrency === null) {
    throw new Error('Currency-priced generation budgets require a currency.');
  }
  if (pricingMode !== 'currency' && generationCurrency !== null) {
    throw new Error('Only currency-priced generation budgets can include a currency.');
  }
  if (pricingMode === 'unpriced' && generationCeiling !== null) {
    throw new Error('Unpriced generation budgets cannot include a ceiling.');
  }
  return {
    ...extensions(value),
    version: 2,
    creationMode: oneOf(value.creationMode, ['ai-generated', 'live-action', 'hybrid'], 'Creation mode'),
    aspectRatio: oneOf(value.aspectRatio, ['9:16', '16:9', '1:1', '4:5'], 'Aspect ratio'),
    targetPlatform: oneOf(
      value.targetPlatform,
      ['short-form', 'youtube', 'film-festival', 'commercial', 'other'],
      'Target platform',
    ),
    genreTone: text(value.genreTone, 'Scene genre and tone', MAX_SHORT_TEXT),
    locationPeriod: text(value.locationPeriod, 'Scene location and period', MAX_SHORT_TEXT),
    dialogueAudioIntent: oneOf(
      value.dialogueAudioIntent,
      ['dialogue-led', 'music-led', 'sound-design-led', 'silent', 'mixed'],
      'Dialogue and audio intent',
    ),
    targetDurationSeconds: positive(value.targetDurationSeconds, 'Target duration'),
    requiredBeats: stringList(value.requiredBeats, 'Required beats', 24),
    mustInclude: stringList(value.mustInclude, 'Must include', 24),
    mustAvoid: stringList(value.mustAvoid, 'Must avoid', 24),
    generationBudget: {
      pricingMode,
      currency: generationCurrency,
      ceiling: generationCeiling,
      maxAttempts,
    },
    productionConstraints: {
      budgetBand: oneOf(
        value.productionConstraints.budgetBand,
        ['micro', 'lean', 'indie', 'custom'],
        'Physical-production budget band',
      ),
      currency: oneOf(value.productionConstraints.currency, ['PHP', 'USD'], 'Production currency'),
      budgetCeiling: nullablePositive(
        value.productionConstraints.budgetCeiling,
        'Physical-production budget ceiling',
      ),
      availableEquipment: stringList(
        value.productionConstraints.availableEquipment,
        'Available equipment',
        100,
      ),
    },
  };
}

function requireHost(hostNodeIds: ReadonlySet<string>, nodeId: string, label: string) {
  if (!hostNodeIds.has(nodeId)) throw new Error(`${label} refers to missing canvas node ${nodeId}.`);
}

function requireReference<T>(records: Record<string, T>, referenceId: string, label: string) {
  if (!records[referenceId]) throw new Error(`${label} refers to missing id ${referenceId}.`);
}

export function createEmptyCinemaProjectData(projectId = 'cineserye-local-project'): CinemaProjectData {
  return {
    schemaVersion: 2,
    projectId,
    activeRevisionId: null,
    revisions: {},
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
    visualPreproduction: createEmptyVisualPreproductionData(),
    professionalPlanning: createDefaultProfessionalPlanningData({
      activeRevisionId: null,
      sceneOrder: [],
      scenes: {},
      shots: {},
      costs: {},
    }),
    multiScene: createDefaultMultiSceneData({ sceneOrder: [] }),
  };
}

function validateCinemaProjectDataV1(
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
    referenceIds: record.referenceIds === undefined ? [] : idList(record.referenceIds, 'Prompt reference ids'),
    version: integer(record.version, 'Prompt version'),
    status: oneOf(record.status, ['draft', 'stale', 'approved'], 'Prompt status'),
  }));
  const sources = recordMap(value.sources, 'Research source', (record) => {
    const legacyStatus = record.status === 'pinned' || record.status === 'suggested'
      ? record.status
      : null;
    return {
      ...extensions(record),
      id: id(record.id, 'Research source id'),
      runId: id(record.runId, 'Research source run id'),
      title: text(record.title, 'Research source title', MAX_SHORT_TEXT),
      publisher: text(record.publisher, 'Research source publisher', MAX_SHORT_TEXT),
      url: record.url === null ? null : text(record.url, 'Research source URL', 4_000),
      finding: text(record.finding, 'Research finding'),
      queryPurpose: text(record.queryPurpose, 'Research query purpose', MAX_SHORT_TEXT),
      status: legacyStatus
        ? legacyStatus === 'pinned' ? 'supported' as const : 'needs-verification' as const
        : oneOf(
          record.status,
          ['supported', 'needs-verification', 'irrelevant'],
          'Research source status',
        ),
      creatorPinned: legacyStatus === 'pinned' || record.creatorPinned === true,
      isMock: record.isMock === true,
      retrievedAt: isoDate(record.retrievedAt, 'Research retrieval time'),
    };
  });
  const costs = recordMap(value.costs, 'Cost estimate', (record) => {
    const pricingMode = record.pricingMode === undefined
      ? 'currency' as const
      : oneOf(record.pricingMode, ['unpriced', 'credits', 'currency'], 'Cost pricing mode');
    const currency = record.currency === null
      ? null
      : oneOf(record.currency, ['PHP', 'USD'], 'Cost currency');
    const minimum = record.minimum === null ? null : finiteNonNegative(record.minimum, 'Minimum cost');
    const expected = record.expected === null ? null : finiteNonNegative(record.expected, 'Expected cost');
    const highRisk = record.highRisk === null ? null : finiteNonNegative(record.highRisk, 'High-risk cost');
    const ceiling = nullableNumber(record.ceiling, 'Cost ceiling');
    if (pricingMode === 'currency' && currency === null) {
      throw new Error('Currency-priced estimates require a currency.');
    }
    if (pricingMode !== 'currency' && currency !== null) {
      throw new Error('Only currency-priced estimates can include a currency.');
    }
    if (pricingMode === 'unpriced' && [minimum, expected, highRisk, ceiling].some((amount) => amount !== null)) {
      throw new Error('Unpriced estimates cannot include numeric amounts.');
    }
    if (pricingMode !== 'unpriced' && [minimum, expected, highRisk].some((amount) => amount === null)) {
      throw new Error('Priced estimates require complete ranges.');
    }
    const assumptionProfileVersion = record.assumptionProfileVersion === undefined
      ? 1
      : integer(record.assumptionProfileVersion, 'Cost assumption profile');
    if (assumptionProfileVersion !== 1) throw new Error('Cost assumption profile is unsupported.');
    const outputCount = record.outputCount === undefined ? 1 : integer(record.outputCount, 'Cost output count');
    const retryAllowance = record.retryAllowance === undefined ? 1 : integer(record.retryAllowance, 'Cost retry allowance');
    if (outputCount < 1) throw new Error('Cost output count must be greater than zero.');
    return {
      ...extensions(record),
      id: id(record.id, 'Cost estimate id'),
      runId: id(record.runId, 'Cost estimate run id'),
      sceneId: id(record.sceneId, 'Cost estimate scene id'),
      pricingMode,
      currency,
      minimum,
      expected,
      highRisk,
      ceiling,
      isIllustrative: true as const,
      assumptionProfileVersion: 1 as const,
      provider: record.provider === undefined ? 'unspecified' : text(record.provider, 'Cost provider', MAX_SHORT_TEXT),
      model: record.model === undefined ? 'unspecified' : text(record.model, 'Cost model', MAX_SHORT_TEXT),
      resolution: record.resolution === undefined ? 'unspecified' : text(record.resolution, 'Cost resolution', MAX_SHORT_TEXT),
      outputCount,
      retryAllowance,
      pricingSnapshotDate: record.pricingSnapshotDate === undefined
        ? null
        : nullableIsoDate(record.pricingSnapshotDate, 'Cost pricing snapshot date'),
      assumptions: stringList(record.assumptions, 'Cost assumptions'),
    };
  });

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
    if (
      cost.minimum !== null
      && cost.expected !== null
      && cost.highRisk !== null
      && (cost.minimum > cost.expected || cost.expected > cost.highRisk)
    ) {
      throw new Error(`Cost estimate ${cost.id} ranges are out of order.`);
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

function revisionSnapshotHostIds(snapshot: Record<string, unknown>): Set<string> {
  const result = new Set<string>();
  const scene = isRecord(snapshot.scene) ? snapshot.scene : null;
  if (scene && typeof scene.nodeId === 'string') result.add(scene.nodeId);
  for (const collectionName of ['shots', 'characters', 'assets', 'agentRuns'] as const) {
    const collection = isRecord(snapshot[collectionName]) ? snapshot[collectionName] : {};
    for (const record of Object.values(collection)) {
      if (isRecord(record) && typeof record.nodeId === 'string') result.add(record.nodeId);
    }
  }
  return result;
}

function validateRevisionSnapshot(value: unknown): CinemaRevisionSnapshot {
  if (!isRecord(value) || !isRecord(value.scene)) throw new Error('Plan revision snapshot is invalid.');
  const sceneId = id(value.scene.id, 'Revision scene id');
  const validated = validateCinemaProjectDataV1({
    schemaVersion: 1,
    projectNodeId: null,
    activeSceneId: sceneId,
    sceneOrder: [sceneId],
    scenes: { [sceneId]: value.scene },
    shots: value.shots,
    characters: value.characters,
    assets: value.assets,
    agentRuns: value.agentRuns,
    prompts: value.prompts,
    sources: value.sources,
    costs: value.costs,
  }, revisionSnapshotHostIds(value));
  return {
    scene: validated.scenes[sceneId],
    shots: validated.shots,
    characters: validated.characters,
    assets: validated.assets,
    agentRuns: validated.agentRuns,
    prompts: validated.prompts,
    sources: validated.sources,
    costs: validated.costs,
  };
}

export function captureCinemaRevisionSnapshot(
  project: CinemaProjectDataV1 | CinemaProjectData,
  sceneId: string,
): CinemaRevisionSnapshot {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error(`Scene ${sceneId} is missing.`);
  const shotIds = new Set(scene.shotIds);
  const shots = Object.fromEntries(Object.entries(project.shots)
    .filter(([shotId]) => shotIds.has(shotId)));
  const characters = Object.fromEntries(Object.entries(project.characters)
    .filter(([, record]) => record.sceneIds.includes(sceneId)));
  const assets = Object.fromEntries(Object.entries(project.assets)
    .filter(([, record]) => record.sceneIds.includes(sceneId)));
  const agentRuns = Object.fromEntries(Object.entries(project.agentRuns)
    .filter(([, record]) => record.sceneId === sceneId));
  const runIds = new Set(Object.keys(agentRuns));
  const prompts = Object.fromEntries(Object.entries(project.prompts)
    .filter(([, record]) => runIds.has(record.runId)));
  const sources = Object.fromEntries(Object.entries(project.sources)
    .filter(([, record]) => runIds.has(record.runId)));
  const costs = Object.fromEntries(Object.entries(project.costs)
    .filter(([, record]) => record.sceneId === sceneId && runIds.has(record.runId)));
  return structuredClone({ scene, shots, characters, assets, agentRuns, prompts, sources, costs });
}

function migratedProjectId(project: CinemaProjectDataV1): string {
  const anchor = project.projectNodeId ?? project.activeSceneId ?? 'local-project';
  return `cineserye-${anchor.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function migrateCinemaProjectDataV1(project: CinemaProjectDataV1): CinemaProjectData {
  const acceptedRun = Object.values(project.agentRuns)
    .filter((run) => run.status === 'accepted')
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0];
  const revisionId = acceptedRun ? `revision-${acceptedRun.id}` : null;
  const revision = acceptedRun ? {
    id: revisionId as string,
    sceneId: acceptedRun.sceneId,
    number: 1,
    runId: acceptedRun.id,
    predecessorRevisionId: null,
    status: 'active' as const,
    summary: acceptedRun.summary,
    createdAt: acceptedRun.startedAt ?? acceptedRun.completedAt ?? '1970-01-01T00:00:00.000Z',
    acceptedAt: acceptedRun.completedAt ?? acceptedRun.startedAt ?? '1970-01-01T00:00:00.000Z',
    snapshot: captureCinemaRevisionSnapshot(project, acceptedRun.sceneId),
  } : null;
  return {
    ...project,
    schemaVersion: 2,
    projectId: migratedProjectId(project),
    activeRevisionId: revisionId,
    revisions: revision ? { [revision.id]: revision } : {},
    visualPreproduction: createEmptyVisualPreproductionData(),
    professionalPlanning: createDefaultProfessionalPlanningData({
      ...project,
      activeRevisionId: revisionId,
    }),
    multiScene: createDefaultMultiSceneData(project),
  };
}

export function validateCinemaProjectData(
  value: unknown,
  hostNodeIds: ReadonlySet<string>,
): CinemaProjectData {
  if (!isRecord(value)) throw new Error('This project uses an unsupported cinema data version.');
  if (value.schemaVersion === 1) {
    return migrateCinemaProjectDataV1(validateCinemaProjectDataV1(value, hostNodeIds));
  }
  if (value.schemaVersion !== 2) throw new Error('This project uses an unsupported cinema data version.');

  const current = validateCinemaProjectDataV1({ ...value, schemaVersion: 1 }, hostNodeIds);
  const revisions = recordMap(value.revisions, 'Plan revision', (record) => ({
    id: id(record.id, 'Plan revision id'),
    sceneId: id(record.sceneId, 'Plan revision scene id'),
    number: positiveInteger(record.number, 'Plan revision number'),
    runId: id(record.runId, 'Plan revision run id'),
    predecessorRevisionId: record.predecessorRevisionId === null
      ? null
      : id(record.predecessorRevisionId, 'Predecessor revision id'),
    status: oneOf(record.status, ['active', 'superseded'], 'Plan revision status'),
    summary: text(record.summary, 'Plan revision summary'),
    createdAt: isoDate(record.createdAt, 'Plan revision creation time'),
    acceptedAt: isoDate(record.acceptedAt, 'Plan revision acceptance time'),
    snapshot: validateRevisionSnapshot(record.snapshot),
  }));
  const projectId = id(value.projectId, 'Cinema project id');
  const activeRevisionId = value.activeRevisionId === null
    ? null
    : id(value.activeRevisionId, 'Active plan revision id');
  if (activeRevisionId !== null && !revisions[activeRevisionId]) {
    throw new Error('Active plan revision is missing.');
  }
  const activeRevisions = Object.values(revisions).filter((revision) => revision.status === 'active');
  const activeRevisionByScene = new Map<string, CinemaPlanRevisionRecord>();
  for (const revision of activeRevisions) {
    if (activeRevisionByScene.has(revision.sceneId)) {
      throw new Error(`Scene ${revision.sceneId} contains more than one active plan revision.`);
    }
    activeRevisionByScene.set(revision.sceneId, revision);
  }
  if (activeRevisionId !== null) {
    const activeRevision = revisions[activeRevisionId];
    if (activeRevision.status !== 'active' || activeRevision.sceneId !== current.activeSceneId) {
      throw new Error('Active plan revision must belong to the active scene.');
    }
  } else if (current.activeSceneId && activeRevisionByScene.has(current.activeSceneId)) {
    throw new Error('The active scene plan revision is not selected.');
  }
  const numbersByScene = new Set<string>();
  for (const revision of Object.values(revisions)) {
    requireReference(current.scenes, revision.sceneId, `Plan revision ${revision.id}`);
    if (!revision.snapshot.agentRuns[revision.runId]) {
      throw new Error(`Plan revision ${revision.id} refers to a missing snapshot run.`);
    }
    if (revision.snapshot.scene.id !== revision.sceneId) {
      throw new Error(`Plan revision ${revision.id} snapshot scene does not match.`);
    }
    const numberKey = `${revision.sceneId}:${revision.number}`;
    if (numbersByScene.has(numberKey)) throw new Error(`Scene ${revision.sceneId} contains duplicate revision numbers.`);
    numbersByScene.add(numberKey);
    if (revision.predecessorRevisionId !== null) {
      const predecessor = revisions[revision.predecessorRevisionId];
      if (!predecessor || predecessor.sceneId !== revision.sceneId || predecessor.number >= revision.number) {
        throw new Error(`Plan revision ${revision.id} has an invalid predecessor.`);
      }
    }
  }
  const visualPreproduction = validateVisualPreproductionData(value.visualPreproduction, {
    scenes: current.scenes,
    shots: current.shots,
    prompts: current.prompts,
    revisions,
  });
  for (const prompt of Object.values(current.prompts)) {
    for (const referenceId of prompt.referenceIds ?? []) {
      if (!visualPreproduction.references[referenceId]) {
        throw new Error(`Prompt ${prompt.id} refers to missing visual reference ${referenceId}.`);
      }
    }
  }
  const professionalPlanning = validateProfessionalPlanningData(value.professionalPlanning, {
    ...current,
    activeRevisionId,
  });
  const multiScene = validateMultiSceneData(value.multiScene, current);
  return {
    ...current,
    ...extensions(value),
    schemaVersion: 2,
    projectId,
    activeRevisionId,
    revisions,
    visualPreproduction,
    professionalPlanning,
    multiScene,
  };
}

export function acceptCinemaPlanRevision(
  current: CinemaProjectData | undefined,
  incoming: CinemaProjectData,
  acceptedAt: string,
): CinemaProjectData {
  const sceneId = incoming.activeSceneId;
  if (!sceneId) throw new Error('An accepted plan requires an active scene.');
  const readyRun = Object.values(incoming.agentRuns).find((record) => record.sceneId === sceneId && record.status === 'ready');
  if (!readyRun) throw new Error('An accepted plan requires one ready agent run.');
  const previous = Object.values(current?.revisions ?? {}).find(
    (revision) => revision.sceneId === sceneId && revision.status === 'active',
  ) ?? null;
  const previousNumbers = Object.values(current?.revisions ?? {})
    .filter((revision) => revision.sceneId === sceneId)
    .map((revision) => revision.number);
  const number = Math.max(0, ...previousNumbers) + 1;
  const revisionId = `${sceneId}-revision-${number}-${readyRun.id}`;
  const next = mergeAcceptedScene(current, incoming, sceneId);
  const run = next.agentRuns[readyRun.id];
  run.status = 'accepted';
  run.completedAt = acceptedAt;
  const revisions = structuredClone(current?.revisions ?? {});
  for (const revision of Object.values(revisions)) {
    if (revision.sceneId === sceneId) revision.status = 'superseded';
  }
  revisions[revisionId] = {
    id: revisionId,
    sceneId,
    number,
    runId: run.id,
    predecessorRevisionId: previous?.id ?? null,
    status: 'active',
    summary: run.summary,
    createdAt: run.startedAt ?? acceptedAt,
    acceptedAt,
    snapshot: captureCinemaRevisionSnapshot(next, sceneId),
  };
  const result: CinemaProjectData = {
    ...next,
    projectId: current?.projectId ?? incoming.projectId,
    activeRevisionId: revisionId,
    revisions,
    visualPreproduction: structuredClone(
      current?.visualPreproduction ?? incoming.visualPreproduction ?? createEmptyVisualPreproductionData(),
    ),
    professionalPlanning: reconcileProfessionalPlanningData(
      { ...next, activeRevisionId: revisionId },
      current?.professionalPlanning ?? incoming.professionalPlanning,
    ),
    multiScene: validateMultiSceneData(
      current?.multiScene ?? incoming.multiScene,
      next,
    ),
  };
  for (const shot of Object.values(result.shots)) {
    const referenceIds = Object.values(result.visualPreproduction?.references ?? {})
      .filter((reference) => reference.shotIds.includes(shot.id))
      .map((reference) => reference.id);
    for (const prompt of Object.values(result.prompts)) {
      if (prompt.ownerNodeId === shot.nodeId && (prompt.purpose === 'storyboard' || prompt.purpose === 'video')) {
        prompt.referenceIds = referenceIds;
      }
    }
  }
  return result;
}

function mergeAcceptedScene(
  current: CinemaProjectData | undefined,
  incoming: CinemaProjectData,
  sceneId: string,
): CinemaProjectData {
  if (!current) return structuredClone(incoming);
  const next = structuredClone(incoming);
  const previousScene = current.scenes[sceneId];
  const normalizedTitle = (value: string) => value.trim().toLocaleLowerCase();
  const continuityHostRemap = new Map<string, string>();
  for (const [incomingId, character] of Object.entries(next.characters)) {
    const shared = Object.values(current.characters).find((candidate) => (
      candidate.sceneIds.includes(sceneId)
      && candidate.sceneIds.length > 1
      && normalizedTitle(candidate.title) === normalizedTitle(character.title)
    ));
    if (shared) {
      continuityHostRemap.set(character.nodeId, shared.nodeId);
      delete next.characters[incomingId];
    }
  }
  for (const [incomingId, asset] of Object.entries(next.assets)) {
    const shared = Object.values(current.assets).find((candidate) => (
      candidate.sceneIds.includes(sceneId)
      && candidate.sceneIds.length > 1
      && candidate.category === asset.category
      && normalizedTitle(candidate.title) === normalizedTitle(asset.title)
    ));
    if (shared) {
      continuityHostRemap.set(asset.nodeId, shared.nodeId);
      delete next.assets[incomingId];
    }
  }
  if (continuityHostRemap.size) {
    for (const shot of Object.values(next.shots)) {
      shot.continuityNodeIds = shot.continuityNodeIds.map((nodeId) => continuityHostRemap.get(nodeId) ?? nodeId);
    }
    for (const prompt of Object.values(next.prompts)) {
      prompt.ownerNodeId = continuityHostRemap.get(prompt.ownerNodeId) ?? prompt.ownerNodeId;
      prompt.continuityNodeIds = prompt.continuityNodeIds.map((nodeId) => continuityHostRemap.get(nodeId) ?? nodeId);
    }
  }
  const previousRunIds = new Set(
    Object.values(current.agentRuns).filter((run) => run.sceneId === sceneId).map((run) => run.id),
  );
  const scenes = structuredClone(current.scenes);
  scenes[sceneId] = {
    ...structuredClone(next.scenes[sceneId]),
    ...(previousScene ? {
      title: previousScene.title,
      dramaticPurpose: previousScene.dramaticPurpose,
      continuityNotes: previousScene.continuityNotes,
    } : {}),
  };
  const sceneOrder = current.sceneOrder.includes(sceneId)
    ? [...current.sceneOrder]
    : [...current.sceneOrder, sceneId];
  const keepOtherSceneRecords = <T extends { sceneId: string }>(records: Record<string, T>) =>
    Object.fromEntries(Object.entries(records).filter(([, record]) => record.sceneId !== sceneId));
  const keepOtherRunRecords = <T extends { runId: string }>(records: Record<string, T>) =>
    Object.fromEntries(Object.entries(records).filter(([, record]) => !previousRunIds.has(record.runId)));
  const retainSharedEntities = <T extends { sceneIds: string[] }>(records: Record<string, T>) =>
    Object.fromEntries(Object.entries(records).flatMap(([key, record]) => {
      if (!record.sceneIds.includes(sceneId) || record.sceneIds.length > 1) {
        return [[key, structuredClone(record)]];
      }
      return [];
    }));
  return {
    ...next,
    projectId: current.projectId,
    projectNodeId: current.projectNodeId ?? next.projectNodeId,
    activeSceneId: sceneId,
    sceneOrder,
    scenes,
    shots: { ...keepOtherSceneRecords(current.shots), ...next.shots },
    characters: { ...retainSharedEntities(current.characters), ...next.characters },
    assets: { ...retainSharedEntities(current.assets), ...next.assets },
    agentRuns: { ...keepOtherSceneRecords(current.agentRuns), ...next.agentRuns },
    prompts: { ...keepOtherRunRecords(current.prompts), ...next.prompts },
    sources: { ...keepOtherRunRecords(current.sources), ...next.sources },
    costs: { ...keepOtherSceneRecords(current.costs), ...next.costs },
    visualPreproduction: structuredClone(
      current.visualPreproduction ?? next.visualPreproduction ?? createEmptyVisualPreproductionData(),
    ),
    professionalPlanning: structuredClone(
      current.professionalPlanning ?? next.professionalPlanning,
    ),
    multiScene: {
      ...(structuredClone(current.multiScene) ?? createDefaultMultiSceneData(current)),
      sceneOrder,
    },
  };
}

export type CinemaRevisionComparison = {
  addedShots: number;
  removedShots: number;
  changedShots: number;
  durationDeltaSeconds: number;
  expectedCostDelta: number | null;
};

export function compareCinemaPlanRevisions(
  predecessor: CinemaPlanRevisionRecord,
  successor: CinemaPlanRevisionRecord,
): CinemaRevisionComparison {
  const before = predecessor.snapshot.shots;
  const after = successor.snapshot.shots;
  const beforeTitles = new Map(Object.values(before).map((shot) => [shot.title.toLocaleLowerCase(), shot]));
  const afterTitles = new Map(Object.values(after).map((shot) => [shot.title.toLocaleLowerCase(), shot]));
  const sharedTitles = [...afterTitles.keys()].filter((title) => beforeTitles.has(title));
  const changedShots = sharedTitles.filter((title) => {
    const left = beforeTitles.get(title);
    const right = afterTitles.get(title);
    return left && right && JSON.stringify(left) !== JSON.stringify(right);
  }).length;
  const totalDuration = (shots: Record<string, CinemaShotRecord>) => Object.values(shots)
    .reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const expectedCost = (revision: CinemaPlanRevisionRecord) => Object.values(revision.snapshot.costs)[0]?.expected ?? null;
  const beforeCost = expectedCost(predecessor);
  const afterCost = expectedCost(successor);
  return {
    addedShots: [...afterTitles.keys()].filter((title) => !beforeTitles.has(title)).length,
    removedShots: [...beforeTitles.keys()].filter((title) => !afterTitles.has(title)).length,
    changedShots,
    durationDeltaSeconds: totalDuration(after) - totalDuration(before),
    expectedCostDelta: beforeCost === null || afterCost === null ? null : afterCost - beforeCost,
  };
}

export type ResearchSourceCuration =
  | { type: 'set-status'; status: CinemaResearchSourceRecord['status'] }
  | { type: 'set-pinned'; pinned: boolean }
  | { type: 'remove' };

export function curateCinemaResearchSource(
  project: CinemaProjectData,
  sourceId: string,
  action: ResearchSourceCuration,
): CinemaProjectData {
  if (!project.sources[sourceId]) throw new Error(`Research source ${sourceId} is missing.`);
  const next = structuredClone(project);
  if (action.type === 'set-status') {
    next.sources[sourceId].status = action.status;
    if (action.status === 'irrelevant') next.sources[sourceId].creatorPinned = false;
  } else if (action.type === 'set-pinned') {
    if (action.pinned && next.sources[sourceId].status === 'irrelevant') {
      throw new Error('An irrelevant source cannot be pinned.');
    }
    next.sources[sourceId].creatorPinned = action.pinned;
  } else {
    delete next.sources[sourceId];
    for (const run of Object.values(next.agentRuns)) {
      run.sourceIds = run.sourceIds.filter((id) => id !== sourceId);
    }
    for (const prompt of Object.values(next.prompts)) {
      prompt.researchSourceIds = prompt.researchSourceIds.filter((id) => id !== sourceId);
    }
  }
  return next;
}

export function supportedCitationIds(
  project: CinemaProjectData,
  sourceIds: readonly string[],
): string[] {
  return [...new Set(sourceIds.filter((sourceId) => project.sources[sourceId]?.status === 'supported'))];
}

export function removeCinemaRecordsForNodes(
  project: CinemaProjectData,
  removedNodeIds: ReadonlySet<string>,
  remainingHostNodeIds: ReadonlySet<string>,
): CinemaProjectData {
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
  for (const [revisionId, revision] of Object.entries(next.revisions)) {
    if (removedSceneIds.has(revision.sceneId)) delete next.revisions[revisionId];
  }
  if (next.activeRevisionId !== null && !next.revisions[next.activeRevisionId]) {
    next.activeRevisionId = null;
  }
  if (next.activeSceneId) {
    next.activeRevisionId = Object.values(next.revisions).find(
      (revision) => revision.sceneId === next.activeSceneId && revision.status === 'active',
    )?.id ?? null;
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

  if (next.visualPreproduction) {
    const removedReferenceIds = new Set<string>();
    for (const [referenceId, reference] of Object.entries(next.visualPreproduction.references)) {
      if (removedSceneIds.has(reference.sceneId)) {
        delete next.visualPreproduction.references[referenceId];
        removedReferenceIds.add(referenceId);
      } else {
        reference.shotIds = reference.shotIds.filter((shotId) => !removedShotIds.has(shotId));
      }
    }
    const removedStoryboardRunIds = new Set<string>();
    for (const [runId, run] of Object.entries(next.visualPreproduction.storyboardRuns)) {
      if (removedShotIds.has(run.shotId)) {
        delete next.visualPreproduction.storyboardRuns[runId];
        removedStoryboardRunIds.add(runId);
      } else {
        run.referenceIds = run.referenceIds.filter((referenceId) => !removedReferenceIds.has(referenceId));
      }
    }
    for (const [frameId, frame] of Object.entries(next.visualPreproduction.storyboardFrames)) {
      if (removedStoryboardRunIds.has(frame.runId) || removedShotIds.has(frame.shotId)) {
        delete next.visualPreproduction.storyboardFrames[frameId];
      } else {
        frame.referenceIds = frame.referenceIds.filter((referenceId) => !removedReferenceIds.has(referenceId));
      }
    }
    for (const prompt of Object.values(next.prompts)) {
      prompt.referenceIds = (prompt.referenceIds ?? []).filter((referenceId) => !removedReferenceIds.has(referenceId));
    }
  }

  if (next.multiScene) {
    next.multiScene.sceneOrder = [...next.sceneOrder];
    for (const [variantId, variant] of Object.entries(next.multiScene.sharedEntityVariants)) {
      if (removedSceneIds.has(variant.sceneId) || removedContinuityNodeIds.has(variant.entityNodeId)) {
        delete next.multiScene.sharedEntityVariants[variantId];
      }
    }
    for (const [exceptionId, exception] of Object.entries(next.multiScene.continuityExceptions)) {
      if (removedSceneIds.has(exception.sceneId) || removedContinuityNodeIds.has(exception.entityNodeId)) {
        delete next.multiScene.continuityExceptions[exceptionId];
      } else {
        exception.shotIds = exception.shotIds.filter((shotId) => !removedShotIds.has(shotId));
      }
    }
  }

  next.professionalPlanning = reconcileProfessionalPlanningData(next, next.professionalPlanning);

  return validateCinemaProjectData(next, remainingHostNodeIds);
}
import { createEmptyVisualPreproductionData, validateVisualPreproductionData } from './visual-preproduction';
import {
  createDefaultProfessionalPlanningData,
  reconcileProfessionalPlanningData,
  validateProfessionalPlanningData,
} from './professional-planning';
import { createDefaultMultiSceneData, validateMultiSceneData } from './multi-scene';
