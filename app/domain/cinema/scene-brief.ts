import type {
  CinemaAspectRatio,
  CinemaBudgetBand,
  CinemaCreationMode,
  CinemaCurrency,
  CinemaDialogueAudioIntent,
  CinemaGenerationBudget,
  CinemaProductionConstraints,
  CinemaTargetPlatform,
} from './project-data';

export type ScenePlanningBriefV1 = {
  version: 1;
  sceneNodeId: string;
  sceneText: string;
  tone: string;
  locationPeriod: string;
  budgetBand: CinemaBudgetBand;
  currency: CinemaCurrency;
  budgetCeiling: number | null;
  targetDurationSeconds: number;
  availableEquipment: string[];
};

export type ScenePlanningBrief = {
  version: 2;
  sceneNodeId: string;
  sceneText: string;
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

export type SceneBriefField =
  | 'sceneNodeId'
  | 'sceneText'
  | 'creationMode'
  | 'aspectRatio'
  | 'targetPlatform'
  | 'genreTone'
  | 'locationPeriod'
  | 'dialogueAudioIntent'
  | 'targetDurationSeconds'
  | 'requiredBeats'
  | 'mustInclude'
  | 'mustAvoid'
  | 'generationBudget'
  | 'productionConstraints';

export class SceneBriefValidationError extends Error {
  constructor(
    readonly field: SceneBriefField,
    message: string,
  ) {
    super(message);
    this.name = 'SceneBriefValidationError';
  }
}

function requiredText(value: unknown, field: SceneBriefField, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SceneBriefValidationError(field, `${label} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new SceneBriefValidationError(field, `${label} is too long.`);
  }
  return result;
}

function textList(
  value: unknown,
  field: SceneBriefField,
  label: string,
  maxItems = 24,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new SceneBriefValidationError(field, `${label} is invalid or too long.`);
  }
  const items = value.map((item) => {
    if (typeof item !== 'string' || item.trim().length > 300) {
      throw new SceneBriefValidationError(field, `Each ${label.toLocaleLowerCase()} item must be 300 characters or less.`);
    }
    return item.trim();
  }).filter(Boolean);
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlaceholderSceneText(value: string) {
  const normalized = value
    .replace(/[\s:._-]+/g, ' ')
    .trim()
    .toLocaleLowerCase();
  return /^(scene|shot)( number)? \d+$/.test(normalized)
    || /^(scene|shot|story premise|untitled scene|describe the scene)$/.test(normalized);
}

function positiveOptionalNumber(value: unknown, field: SceneBriefField, label: string) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100_000_000) {
    throw new SceneBriefValidationError(field, `${label} must be a positive amount.`);
  }
  return value;
}

function validateGenerationBudget(value: unknown): CinemaGenerationBudget {
  if (!isRecord(value)) {
    throw new SceneBriefValidationError('generationBudget', 'Choose an AI-generation budget approach.');
  }
  const pricingModes: CinemaGenerationBudget['pricingMode'][] = ['unpriced', 'credits', 'currency'];
  if (!pricingModes.includes(value.pricingMode as CinemaGenerationBudget['pricingMode'])) {
    throw new SceneBriefValidationError('generationBudget', 'Choose currency, credits, or unpriced guidance.');
  }
  const pricingMode = value.pricingMode as CinemaGenerationBudget['pricingMode'];
  const currencies: CinemaCurrency[] = ['PHP', 'USD'];
  const currency = value.currency === null ? null : value.currency as CinemaCurrency;
  if ((pricingMode === 'currency' && !currency) || (currency !== null && !currencies.includes(currency))) {
    throw new SceneBriefValidationError('generationBudget', 'Choose a supported generation-budget currency.');
  }
  if (pricingMode !== 'currency' && currency !== null) {
    throw new SceneBriefValidationError('generationBudget', 'Only currency budgets can include a currency.');
  }
  const ceiling = positiveOptionalNumber(value.ceiling, 'generationBudget', 'Generation ceiling');
  if (pricingMode === 'unpriced' && ceiling !== null) {
    throw new SceneBriefValidationError('generationBudget', 'Unpriced guidance cannot include a numeric ceiling.');
  }
  if (typeof value.maxAttempts !== 'number' || !Number.isInteger(value.maxAttempts)
    || value.maxAttempts < 1 || value.maxAttempts > 20) {
    throw new SceneBriefValidationError('generationBudget', 'Generation attempts must be between 1 and 20.');
  }
  return {
    pricingMode,
    currency,
    ceiling,
    maxAttempts: value.maxAttempts,
  };
}

function validateProductionConstraints(value: unknown): CinemaProductionConstraints {
  if (!isRecord(value)) {
    throw new SceneBriefValidationError('productionConstraints', 'Production constraints are required.');
  }
  const budgetBands: CinemaBudgetBand[] = ['micro', 'lean', 'indie', 'custom'];
  if (!budgetBands.includes(value.budgetBand as CinemaBudgetBand)) {
    throw new SceneBriefValidationError('productionConstraints', 'Choose a physical-production budget band.');
  }
  const currencies: CinemaCurrency[] = ['PHP', 'USD'];
  if (!currencies.includes(value.currency as CinemaCurrency)) {
    throw new SceneBriefValidationError('productionConstraints', 'Choose a supported production currency.');
  }
  return {
    budgetBand: value.budgetBand as CinemaBudgetBand,
    currency: value.currency as CinemaCurrency,
    budgetCeiling: positiveOptionalNumber(
      value.budgetCeiling,
      'productionConstraints',
      'Physical-production ceiling',
    ),
    availableEquipment: textList(
      value.availableEquipment,
      'productionConstraints',
      'Available equipment',
      50,
    ),
  };
}

export function migrateScenePlanningBriefV1(value: ScenePlanningBriefV1): ScenePlanningBrief {
  return {
    version: 2,
    sceneNodeId: value.sceneNodeId,
    sceneText: value.sceneText,
    creationMode: 'ai-generated',
    aspectRatio: '9:16',
    targetPlatform: 'short-form',
    genreTone: value.tone,
    locationPeriod: value.locationPeriod,
    dialogueAudioIntent: 'mixed',
    targetDurationSeconds: value.targetDurationSeconds,
    requiredBeats: [],
    mustInclude: [],
    mustAvoid: [],
    generationBudget: {
      pricingMode: 'currency',
      currency: value.currency,
      ceiling: value.budgetCeiling,
      maxAttempts: 2,
    },
    productionConstraints: {
      budgetBand: value.budgetBand,
      currency: value.currency,
      budgetCeiling: null,
      availableEquipment: [...value.availableEquipment],
    },
  };
}

export function validateScenePlanningBrief(value: unknown): ScenePlanningBrief {
  if (!isRecord(value)) throw new Error('The scene brief is invalid.');
  const candidate = value.version === 1
    ? migrateScenePlanningBriefV1(value as ScenePlanningBriefV1)
    : value;
  if (!isRecord(candidate) || candidate.version !== 2) {
    throw new Error('This scene brief version is unsupported.');
  }

  const creationModes: CinemaCreationMode[] = ['ai-generated', 'live-action', 'hybrid'];
  const aspectRatios: CinemaAspectRatio[] = ['9:16', '16:9', '1:1', '4:5'];
  const targetPlatforms: CinemaTargetPlatform[] = ['short-form', 'youtube', 'film-festival', 'commercial', 'other'];
  const audioIntents: CinemaDialogueAudioIntent[] = ['dialogue-led', 'music-led', 'sound-design-led', 'silent', 'mixed'];
  if (!creationModes.includes(candidate.creationMode as CinemaCreationMode)) {
    throw new SceneBriefValidationError('creationMode', 'Choose how the scene will be created.');
  }
  if (!aspectRatios.includes(candidate.aspectRatio as CinemaAspectRatio)) {
    throw new SceneBriefValidationError('aspectRatio', 'Choose a supported aspect ratio.');
  }
  if (!targetPlatforms.includes(candidate.targetPlatform as CinemaTargetPlatform)) {
    throw new SceneBriefValidationError('targetPlatform', 'Choose a target platform.');
  }
  if (!audioIntents.includes(candidate.dialogueAudioIntent as CinemaDialogueAudioIntent)) {
    throw new SceneBriefValidationError('dialogueAudioIntent', 'Choose a dialogue and audio approach.');
  }
  if (
    typeof candidate.targetDurationSeconds !== 'number'
    || !Number.isFinite(candidate.targetDurationSeconds)
    || candidate.targetDurationSeconds < 6
    || candidate.targetDurationSeconds > 180
  ) {
    throw new SceneBriefValidationError(
      'targetDurationSeconds',
      'Target duration must be between 6 and 180 seconds.',
    );
  }

  const sceneText = requiredText(candidate.sceneText, 'sceneText', 'Scene text', 20_000);
  if (isPlaceholderSceneText(sceneText)) {
    throw new SceneBriefValidationError(
      'sceneText',
      'Replace the placeholder with the scene action, subject, conflict, or desired moment before planning.',
    );
  }

  return {
    version: 2,
    sceneNodeId: requiredText(candidate.sceneNodeId, 'sceneNodeId', 'Scene id', 160),
    sceneText,
    creationMode: candidate.creationMode as CinemaCreationMode,
    aspectRatio: candidate.aspectRatio as CinemaAspectRatio,
    targetPlatform: candidate.targetPlatform as CinemaTargetPlatform,
    genreTone: requiredText(candidate.genreTone, 'genreTone', 'Genre and tone', 500),
    locationPeriod: requiredText(candidate.locationPeriod, 'locationPeriod', 'Location and period', 500),
    dialogueAudioIntent: candidate.dialogueAudioIntent as CinemaDialogueAudioIntent,
    targetDurationSeconds: Math.round(candidate.targetDurationSeconds),
    requiredBeats: textList(candidate.requiredBeats, 'requiredBeats', 'Required beats'),
    mustInclude: textList(candidate.mustInclude, 'mustInclude', 'Must include'),
    mustAvoid: textList(candidate.mustAvoid, 'mustAvoid', 'Must avoid'),
    generationBudget: validateGenerationBudget(candidate.generationBudget),
    productionConstraints: validateProductionConstraints(candidate.productionConstraints),
  };
}
