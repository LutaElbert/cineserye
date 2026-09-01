import type { CinemaBudgetBand, CinemaCurrency } from './project-data';

export type ScenePlanningBrief = {
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

export type SceneBriefField =
  | 'sceneNodeId'
  | 'sceneText'
  | 'tone'
  | 'locationPeriod'
  | 'budgetBand'
  | 'currency'
  | 'budgetCeiling'
  | 'targetDurationSeconds'
  | 'availableEquipment';

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

export function validateScenePlanningBrief(value: ScenePlanningBrief): ScenePlanningBrief {
  if (value.version !== 1) throw new Error('This scene brief version is unsupported.');
  const budgetBands: CinemaBudgetBand[] = ['micro', 'lean', 'indie', 'custom'];
  const currencies: CinemaCurrency[] = ['PHP', 'USD'];
  if (!budgetBands.includes(value.budgetBand)) {
    throw new SceneBriefValidationError('budgetBand', 'Choose a production budget band.');
  }
  if (!currencies.includes(value.currency)) {
    throw new SceneBriefValidationError('currency', 'Choose a supported budget currency.');
  }
  if (
    value.budgetCeiling !== null
    && (!Number.isFinite(value.budgetCeiling) || value.budgetCeiling <= 0 || value.budgetCeiling > 100_000_000)
  ) {
    throw new SceneBriefValidationError('budgetCeiling', 'Budget ceiling must be a positive amount.');
  }
  if (
    !Number.isFinite(value.targetDurationSeconds)
    || value.targetDurationSeconds < 5
    || value.targetDurationSeconds > 180
  ) {
    throw new SceneBriefValidationError(
      'targetDurationSeconds',
      'Target duration must be between 5 and 180 seconds.',
    );
  }
  if (!Array.isArray(value.availableEquipment) || value.availableEquipment.length > 50) {
    throw new SceneBriefValidationError('availableEquipment', 'Available equipment is invalid or too long.');
  }
  const availableEquipment = value.availableEquipment.map((item) => {
    if (typeof item !== 'string' || item.trim().length > 200) {
      throw new SceneBriefValidationError('availableEquipment', 'Each equipment item must be 200 characters or less.');
    }
    return item.trim();
  }).filter(Boolean);

  return {
    version: 1,
    sceneNodeId: requiredText(value.sceneNodeId, 'sceneNodeId', 'Scene id', 160),
    sceneText: requiredText(value.sceneText, 'sceneText', 'Scene text', 20_000),
    tone: requiredText(value.tone, 'tone', 'Tone', 500),
    locationPeriod: requiredText(value.locationPeriod, 'locationPeriod', 'Location and period', 500),
    budgetBand: value.budgetBand,
    currency: value.currency,
    budgetCeiling: value.budgetCeiling,
    targetDurationSeconds: Math.round(value.targetDurationSeconds),
    availableEquipment: [...new Set(availableEquipment)],
  };
}
