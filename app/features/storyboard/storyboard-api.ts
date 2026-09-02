import type { CinemaAspectRatio } from '../../domain/cinema/project-data';
import type { CinemaStoryboardIntent } from '../../domain/cinema/visual-preproduction';
import type { ProviderErrorCode } from '../scene-planner/plan-scene-api';

export type StoryboardReferenceInput = {
  id: string;
  title: string;
  rightsStatus: 'creator-owned' | 'licensed' | 'public-domain';
  approvalStatus: 'approved';
  allowedUses: string[];
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64: string;
};

export type GenerateStoryboardRequest = {
  version: 1;
  idempotencyKey: string;
  shotId: string;
  revisionId: string;
  acceptedPlan: true;
  prompt: { id: string; version: number; text: string; purpose: 'storyboard'; status: string };
  references: StoryboardReferenceInput[];
  settings: { aspectRatio: CinemaAspectRatio; outputCount: number; intent: CinemaStoryboardIntent };
  explicitConfirmation: boolean;
  liveProviderConsent: boolean;
};

export type StoryboardProviderFrame = {
  id: string;
  variantIndex: number;
  seed: number;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  base64: string;
  width: number;
  height: number;
  safetyStatus: 'passed' | 'blocked';
};

export type GenerateStoryboardResponse = {
  ok: true;
  version: 1;
  mode: 'fixture' | 'live';
  runId: string;
  provider: string;
  model: string;
  estimatedCost: number | null;
  currency: 'USD' | null;
  frames: StoryboardProviderFrame[];
} | {
  ok: false;
  error: { code: ProviderErrorCode; message: string; retryable: boolean };
};
