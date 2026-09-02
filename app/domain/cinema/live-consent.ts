import type { ScenePlanningBrief } from './scene-brief';

export type CinemaConsentReceipt = {
  policyVersion: 1;
  contentDigest: string;
  approvedAt: string;
  approvedMaxCost: number;
  planningModel: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown) {
  const source = stable(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `consent-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createCinemaConsentReceipt(
  brief: ScenePlanningBrief,
  approvedMaxCost: number,
  approvedAt: string,
  planningModel: string,
): CinemaConsentReceipt {
  if (!Number.isFinite(approvedMaxCost) || approvedMaxCost <= 0) throw new Error('Consent requires a positive maximum cost.');
  if (!Number.isFinite(Date.parse(approvedAt))) throw new Error('Consent time is invalid.');
  if (!planningModel.trim()) throw new Error('Consent requires the selected planning model.');
  return {
    policyVersion: 1,
    contentDigest: digest({
      policyVersion: 1,
      providers: ['parallel', 'vertex-gemini'],
      planningModel,
      approvedMaxCost,
      brief,
    }),
    approvedAt,
    approvedMaxCost,
    planningModel,
  };
}
