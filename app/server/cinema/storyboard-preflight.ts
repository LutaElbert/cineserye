import 'server-only';
import type { StoryboardPreflight } from '../../features/storyboard/storyboard-api';
import { buildCinemaLivePreflight } from './live-preflight';
import { operationDigest } from './operation-repository';
import { readCinemaProviderConfig } from './provider-config';

export function storyboardPreflight(environment = process.env): StoryboardPreflight {
  const config = readCinemaProviderConfig(environment, false);
  const mode = config.mode;
  const model = mode === 'live'
    ? environment.CINESERYE_VERTEX_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'
    : 'fixture-cinematic-board-v1';
  const unitCost = mode === 'fixture' ? 0 : Number(environment.CINESERYE_STORYBOARD_USD_PER_IMAGE ?? NaN);
  const requestedMax = mode === 'fixture' ? 0 : Number(environment.CINESERYE_STORYBOARD_MAX_ESTIMATED_USD ?? NaN);
  const maxOutputs = Number(environment.CINESERYE_STORYBOARD_MAX_OUTPUTS ?? 4);
  const blockers = mode === 'live' ? buildCinemaLivePreflight(config).blockers : [];
  if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(requestedMax) || (mode === 'live' && (unitCost <= 0 || requestedMax <= 0))) {
    blockers.push('Configure image pricing and a positive per-request spend limit.');
  }
  if (!Number.isInteger(maxOutputs) || maxOutputs < 1 || maxOutputs > 4) blockers.push('Image output limit must be between 1 and 4.');
  const policy = { mode, model, unitCost: Number.isFinite(unitCost) ? unitCost : 0,
    maxCost: mode === 'fixture' ? 0 : Math.min(Number.isFinite(requestedMax) ? requestedMax : 0, config.maxLiveRunCost ?? 0),
    maxOutputs: Number.isInteger(maxOutputs) && maxOutputs >= 1 && maxOutputs <= 4 ? maxOutputs : 1 };
  return { ...policy, ready: blockers.length === 0, blockers, quoteId: operationDigest({ policyVersion: 1, ...policy }) };
}
