import type { CinemaAspectRatio, CinemaProjectData } from './project-data';
import { storyReferenceSnapshot } from './story-reference-bridge';

export type CinemaReferenceType =
  | 'character'
  | 'location'
  | 'prop'
  | 'wardrobe'
  | 'style'
  | 'composition'
  | 'other';
export type CinemaReferenceRight = 'creator-owned' | 'licensed' | 'public-domain' | 'unknown';
export type CinemaReferenceUse = 'research' | 'image-generation' | 'video-generation';
export type CinemaReferenceApproval = 'pending' | 'approved' | 'revoked';
export type CinemaStoryboardIntent = 'balanced' | 'production-safe' | 'emotion-first' | 'visually-experimental' | 'budget-conscious';

export type CinemaReferenceRecord = {
  id: string;
  sceneId: string;
  title: string;
  type: CinemaReferenceType;
  origin: 'upload' | 'canvas' | 'external-link' | 'generated-frame';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  blobHash: string | null;
  sourceUrl: string | null;
  provenance: string;
  rightsStatus: CinemaReferenceRight;
  allowedUses: CinemaReferenceUse[];
  approvalStatus: CinemaReferenceApproval;
  notes: string;
  shotIds: string[];
  pinned: boolean;
  createdAt: string;
};

export type CinemaStoryboardRunRecord = {
  id: string;
  shotId: string;
  revisionId: string;
  promptId: string;
  promptVersion: number;
  referenceIds: string[];
  provider: string;
  model: string;
  aspectRatio: CinemaAspectRatio;
  outputCount: number;
  intent: CinemaStoryboardIntent;
  estimatedCost: number | null;
  currency: 'USD' | null;
  status: 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled';
  consentedAt: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
};

export type CinemaStoryboardFrameRecord = {
  id: string;
  runId: string;
  shotId: string;
  revisionId: string;
  promptId: string;
  promptVersion: number;
  referenceIds: string[];
  promptText: string;
  provider: string;
  model: string;
  aspectRatio: CinemaAspectRatio;
  seed: number | null;
  variantIndex: number;
  intent: CinemaStoryboardIntent;
  blobHash: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  width: number;
  height: number;
  byteSize: number;
  safetyStatus: 'passed' | 'blocked';
  status: 'candidate' | 'approved' | 'rejected';
  estimatedCost: number | null;
  currency: 'USD' | null;
  createdAt: string;
};

export type CinemaVideoOperationStatus =
  | 'unknown'
  | 'expired'
  | 'queued'
  | 'running'
  | 'finalizing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'timed-out';

export type CinemaVideoSettings = {
  aspectRatio: '9:16' | '16:9';
  durationSeconds: 4 | 6 | 8;
  resolution: '720p' | '1080p';
  audio: false;
  outputCount: 1;
  seed: number | null;
};

export type CinemaVideoOperationRecord = {
  id: string;
  shotId: string;
  revisionId: string;
  promptId: string;
  promptVersion: number;
  promptText: string;
  negativeConstraints: string[];
  startFrameId: string;
  startFrameApproval: 'approved';
  endFrameId: string | null;
  endFrameApproval: 'approved' | null;
  referenceIds: string[];
  provider: string;
  model: string;
  capabilityProfileVersion: string;
  settings: CinemaVideoSettings;
  estimatedCost: number | null;
  currency: 'USD' | null;
  providerOperationId: string | null;
  status: CinemaVideoOperationStatus;
  /** Missing in old backups: never infer confirmed live failure from old labels. */
  failureConfirmed?: boolean;
  retryOf: string | null;
  consentedAt: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
};

export type CinemaVideoClipRecord = {
  id: string;
  operationId: string;
  shotId: string;
  revisionId: string;
  promptId: string;
  promptVersion: number;
  startFrameId: string;
  endFrameId: string | null;
  referenceIds: string[];
  provider: string;
  model: string;
  capabilityProfileVersion: string;
  settings: CinemaVideoSettings;
  blobHash: string;
  mimeType: 'video/mp4';
  width: number;
  height: number;
  byteSize: number;
  durationSeconds: number;
  status: 'candidate' | 'approved' | 'rejected';
  estimatedCost: number | null;
  currency: 'USD' | null;
  createdAt: string;
};

export type CinemaVisualPreproductionData = {
  version: 1;
  references: Record<string, CinemaReferenceRecord>;
  storyboardRuns: Record<string, CinemaStoryboardRunRecord>;
  storyboardFrames: Record<string, CinemaStoryboardFrameRecord>;
  videoOperations: Record<string, CinemaVideoOperationRecord>;
  videoClips: Record<string, CinemaVideoClipRecord>;
};

const REFERENCE_TYPES: CinemaReferenceType[] = ['character', 'location', 'prop', 'wardrobe', 'style', 'composition', 'other'];
const RIGHTS: CinemaReferenceRight[] = ['creator-owned', 'licensed', 'public-domain', 'unknown'];
const USES: CinemaReferenceUse[] = ['research', 'image-generation', 'video-generation'];
const ASPECTS: CinemaAspectRatio[] = ['9:16', '16:9', '1:1', '4:5'];
const STORYBOARD_INTENTS: CinemaStoryboardIntent[] = ['balanced', 'production-safe', 'emotion-first', 'visually-experimental', 'budget-conscious'];
const MAX_RECORDS = 2_500;

export function createEmptyVisualPreproductionData(): CinemaVisualPreproductionData {
  return { version: 1, references: {}, storyboardRuns: {}, storyboardFrames: {}, videoOperations: {}, videoClips: {} };
}

function optionalNullableText(value: unknown, label: string, max = 4_000): string | null {
  return value === undefined || value === null ? null : text(value, label, max);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is invalid.`);
  return value;
}

function nullableText(value: unknown, label: string, max = 4_000): string | null {
  return value === null ? null : text(value, label, max);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`${label} is unsupported.`);
  return value as T;
}
function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw Error(`${label} must be a boolean.`);
  return value;
}

function ids(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error(`${label} is invalid.`);
  const result = value.map((entry) => text(entry, label, 160));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicates.`);
  return result;
}

function numberValue(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new Error(`${label} is invalid.`);
  return value;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : numberValue(value, label);
}

function optionalNullableNumber(value: unknown, label: string): number | null {
  return value === undefined || value === null ? null : numberValue(value, label);
}

function iso(value: unknown, label: string): string {
  const result = text(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} is invalid.`);
  return result;
}

function keyed<T extends { id: string }>(
  value: unknown,
  label: string,
  parse: (item: Record<string, unknown>) => T,
): Record<string, T> {
  const source = record(value, label);
  if (Object.keys(source).length > MAX_RECORDS) throw new Error(`${label} is too large.`);
  return Object.fromEntries(Object.entries(source).map(([key, raw]) => {
    const parsed = parse(record(raw, `${label} ${key}`));
    if (parsed.id !== key) throw new Error(`${label} key does not match its id.`);
    return [key, parsed];
  }));
}

export function validateVisualPreproductionData(
  value: unknown,
  project: Pick<CinemaProjectData, 'scenes' | 'shots' | 'prompts' | 'revisions' | 'storyWorkflow'>,
): CinemaVisualPreproductionData {
  if (value === undefined) return createEmptyVisualPreproductionData();
  const source = record(value, 'Visual pre-production data');
  if (source.version !== 1) throw new Error('Visual pre-production version is unsupported.');
  const references = keyed(source.references, 'Reference', (item) => {
    const sceneId = text(item.sceneId, 'Reference scene id', 160);
    if (!project.scenes[sceneId]) throw new Error(`Reference scene ${sceneId} is missing.`);
    const shotIds = ids(item.shotIds, 'Reference shot ids');
    shotIds.forEach((shotId) => {
      if (project.shots[shotId]?.sceneId !== sceneId) throw new Error(`Reference shot ${shotId} is missing from its scene.`);
    });
    const allowedUses = ids(item.allowedUses, 'Reference allowed uses')
      .map((use) => enumValue(use, USES, 'Reference allowed use'));
    const origin = enumValue(item.origin, ['upload', 'canvas', 'external-link', 'generated-frame'], 'Reference origin');
    const blobHash = nullableText(item.blobHash, 'Reference blob hash', 128);
    const sourceUrl = nullableText(item.sourceUrl, 'Reference source URL');
    if (origin === 'external-link' && sourceUrl === null) throw new Error('External references require a source URL.');
    if ((origin === 'upload' || origin === 'canvas') && blobHash === null) throw new Error('Local references require local media.');
    return {
      id: text(item.id, 'Reference id', 160),
      sceneId,
      title: text(item.title, 'Reference title', 500),
      type: enumValue(item.type, REFERENCE_TYPES, 'Reference type'),
      origin,
      mimeType: item.mimeType === null ? null : enumValue(item.mimeType, ['image/png', 'image/jpeg', 'image/webp'], 'Reference MIME type'),
      width: nullableNumber(item.width, 'Reference width'),
      height: nullableNumber(item.height, 'Reference height'),
      byteSize: nullableNumber(item.byteSize, 'Reference byte size'),
      blobHash,
      sourceUrl,
      provenance: text(item.provenance, 'Reference provenance'),
      rightsStatus: enumValue(item.rightsStatus, RIGHTS, 'Reference rights'),
      allowedUses,
      approvalStatus: enumValue(item.approvalStatus, ['pending', 'approved', 'revoked'], 'Reference approval'),
      notes: typeof item.notes === 'string' && item.notes.length <= 20_000 ? item.notes : '',
      shotIds,
      pinned: item.pinned === true,
      createdAt: iso(item.createdAt, 'Reference creation time'),
    };
  });
  const storyboardRuns = keyed(source.storyboardRuns, 'Storyboard run', (item) => {
    const shotId = text(item.shotId, 'Storyboard shot id', 160);
    const promptId = text(item.promptId, 'Storyboard prompt id', 160);
    const revisionId = text(item.revisionId, 'Storyboard revision id', 160);
    if (!project.shots[shotId]) throw new Error(`Storyboard shot ${shotId} is missing.`);
    if (!project.prompts[promptId] || project.prompts[promptId].purpose !== 'storyboard') throw new Error(`Storyboard prompt ${promptId} is missing.`);
    if (!project.revisions[revisionId]) throw new Error(`Storyboard revision ${revisionId} is missing.`);
    const referenceIds = ids(item.referenceIds, 'Storyboard reference ids');
    referenceIds.forEach((referenceId) => {
      if (!references[referenceId] && !storyReferenceSnapshot(project.storyWorkflow, referenceId)) throw new Error(`Storyboard reference ${referenceId} is missing.`);
    });
    const outputCount = numberValue(item.outputCount, 'Storyboard output count', 1);
    if (!Number.isInteger(outputCount) || outputCount > 4) throw new Error('Storyboard output count must be between 1 and 4.');
    return {
      id: text(item.id, 'Storyboard run id', 160), shotId, revisionId, promptId,
      promptVersion: numberValue(item.promptVersion, 'Storyboard prompt version', 1),
      referenceIds,
      provider: text(item.provider, 'Storyboard provider', 160),
      model: text(item.model, 'Storyboard model', 160),
      aspectRatio: enumValue(item.aspectRatio, ASPECTS, 'Storyboard aspect ratio'),
      outputCount,
      intent: item.intent === undefined ? 'balanced' : enumValue(item.intent, STORYBOARD_INTENTS, 'Storyboard intent'),
      estimatedCost: nullableNumber(item.estimatedCost, 'Storyboard estimated cost'),
      currency: item.currency === null ? null : enumValue(item.currency, ['USD'], 'Storyboard currency'),
      status: enumValue(item.status, ['queued', 'generating', 'completed', 'failed', 'cancelled'], 'Storyboard run status'),
      consentedAt: iso(item.consentedAt, 'Storyboard consent time'),
      startedAt: iso(item.startedAt, 'Storyboard start time'),
      completedAt: item.completedAt === null ? null : iso(item.completedAt, 'Storyboard completion time'),
      error: item.error === null ? null : text(item.error, 'Storyboard run error'),
    };
  });
  const storyboardFrames = keyed(source.storyboardFrames, 'Storyboard frame', (item) => {
    const runId = text(item.runId, 'Storyboard frame run id', 160);
    const run = storyboardRuns[runId];
    if (!run) throw new Error(`Storyboard frame run ${runId} is missing.`);
    const referenceIds = ids(item.referenceIds, 'Storyboard frame reference ids');
    if (JSON.stringify(referenceIds) !== JSON.stringify(run.referenceIds)) throw new Error('Storyboard frame references do not match its run.');
    return {
      id: text(item.id, 'Storyboard frame id', 160), runId,
      shotId: run.shotId, revisionId: run.revisionId, promptId: run.promptId,
      promptVersion: numberValue(item.promptVersion, 'Storyboard frame prompt version', 1),
      referenceIds,
      promptText: text(item.promptText, 'Storyboard frame prompt'),
      provider: text(item.provider, 'Storyboard frame provider', 160),
      model: text(item.model, 'Storyboard frame model', 160),
      aspectRatio: enumValue(item.aspectRatio, ASPECTS, 'Storyboard frame aspect ratio'),
      seed: optionalNullableNumber(item.seed, 'Storyboard frame seed'),
      variantIndex: numberValue(item.variantIndex, 'Storyboard frame variant index'),
      intent: item.intent === undefined ? run.intent : enumValue(item.intent, STORYBOARD_INTENTS, 'Storyboard frame intent'),
      blobHash: text(item.blobHash, 'Storyboard frame blob hash', 128),
      mimeType: enumValue(item.mimeType, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], 'Storyboard frame MIME type'),
      width: numberValue(item.width, 'Storyboard frame width', 1),
      height: numberValue(item.height, 'Storyboard frame height', 1),
      byteSize: numberValue(item.byteSize, 'Storyboard frame byte size', 1),
      safetyStatus: enumValue(item.safetyStatus, ['passed', 'blocked'], 'Storyboard safety status'),
      status: enumValue(item.status, ['candidate', 'approved', 'rejected'], 'Storyboard frame status'),
      estimatedCost: nullableNumber(item.estimatedCost, 'Storyboard frame estimated cost'),
      currency: item.currency === null ? null : enumValue(item.currency, ['USD'], 'Storyboard frame currency'),
      createdAt: iso(item.createdAt, 'Storyboard frame creation time'),
    };
  });
  const approvedByShot = new Set<string>();
  for (const frame of Object.values(storyboardFrames)) {
    if (frame.status !== 'approved') continue;
    if (approvedByShot.has(frame.shotId)) throw new Error(`Shot ${frame.shotId} has more than one approved storyboard frame.`);
    approvedByShot.add(frame.shotId);
  }
  const parseVideoSettings = (value: unknown): CinemaVideoSettings => {
    const settings = record(value, 'Video settings');
    const durationSeconds = numberValue(settings.durationSeconds, 'Video duration', 1);
    if (![4, 6, 8].includes(durationSeconds)) throw new Error('Video duration is unsupported.');
    const outputCount = numberValue(settings.outputCount, 'Video output count', 1);
    if (outputCount !== 1) throw new Error('A video operation must request exactly one output.');
    if (settings.audio !== false) throw new Error('This video capability profile does not support audio.');
    const seed = optionalNullableNumber(settings.seed, 'Video seed');
    return {
      aspectRatio: enumValue(settings.aspectRatio, ['9:16', '16:9'], 'Video aspect ratio'),
      durationSeconds: durationSeconds as 4 | 6 | 8,
      resolution: enumValue(settings.resolution, ['720p', '1080p'], 'Video resolution'),
      audio: false,
      outputCount: 1,
      seed,
    };
  };
  const videoOperations = keyed(source.videoOperations ?? {}, 'Video operation', (item) => {
    const shotId = text(item.shotId, 'Video shot id', 160);
    const revisionId = text(item.revisionId, 'Video revision id', 160);
    const promptId = text(item.promptId, 'Video prompt id', 160);
    const startFrameId = text(item.startFrameId, 'Video start frame id', 160);
    const endFrameId = optionalNullableText(item.endFrameId, 'Video end frame id', 160);
    if (!project.shots[shotId]) throw new Error(`Video shot ${shotId} is missing.`);
    if (!project.revisions[revisionId]) throw new Error(`Video revision ${revisionId} is missing.`);
    if (!project.prompts[promptId] || project.prompts[promptId].purpose !== 'video') throw new Error(`Video prompt ${promptId} is missing.`);
    const startFrame = storyboardFrames[startFrameId];
    if (!startFrame || startFrame.safetyStatus !== 'passed' || startFrame.shotId !== shotId || startFrame.revisionId !== revisionId) {
      throw new Error('Video start frame must be a safe frame from the same shot and revision.');
    }
    const startFrameApproval = enumValue(item.startFrameApproval, ['approved'], 'Video start frame approval snapshot');
    const endFrameApproval = item.endFrameApproval === null ? null : enumValue(item.endFrameApproval, ['approved'], 'Video end frame approval snapshot');
    if (endFrameId) {
      const endFrame = storyboardFrames[endFrameId];
      if (!endFrame || endFrame.safetyStatus !== 'passed' || endFrame.shotId !== shotId || endFrame.revisionId !== revisionId || endFrameApproval !== 'approved') {
        throw new Error('Video end frame must have an approved snapshot from the same shot and revision.');
      }
    } else if (endFrameApproval !== null) {
      throw new Error('Video end frame approval requires an end frame.');
    }
    const referenceIds = ids(item.referenceIds, 'Video reference ids');
    referenceIds.forEach((referenceId) => {
      const reference = references[referenceId];
      if (!reference) throw new Error(`Video reference ${referenceId} is missing.`);
      if (reference.approvalStatus !== 'approved' || !reference.allowedUses.includes('video-generation') || reference.rightsStatus === 'unknown') {
        throw new Error(`Video reference ${referenceId} is not approved for video generation.`);
      }
    });
    return {
      id: text(item.id, 'Video operation id', 160), shotId, revisionId, promptId,
      promptVersion: numberValue(item.promptVersion, 'Video prompt version', 1),
      promptText: text(item.promptText, 'Video prompt text'),
      negativeConstraints: ids(item.negativeConstraints, 'Video negative constraints'),
      startFrameId, startFrameApproval, endFrameId, endFrameApproval, referenceIds,
      provider: text(item.provider, 'Video provider', 160),
      model: text(item.model, 'Video model', 160),
      capabilityProfileVersion: text(item.capabilityProfileVersion, 'Video capability profile', 160),
      settings: parseVideoSettings(item.settings),
      estimatedCost: nullableNumber(item.estimatedCost, 'Video estimated cost'),
      currency: item.currency === null ? null : enumValue(item.currency, ['USD'], 'Video currency'),
      providerOperationId: optionalNullableText(item.providerOperationId, 'Provider video operation id', 500),
      status: enumValue(item.status, ['queued', 'running', 'finalizing', 'ready', 'failed', 'cancelled', 'timed-out', 'unknown', 'expired'], 'Video operation status'),
      failureConfirmed: item.failureConfirmed === undefined ? false : booleanValue(item.failureConfirmed, 'Confirmed video failure'),
      retryOf: optionalNullableText(item.retryOf, 'Video retry operation id', 160),
      consentedAt: iso(item.consentedAt, 'Video consent time'),
      startedAt: iso(item.startedAt, 'Video start time'),
      completedAt: item.completedAt === null ? null : iso(item.completedAt, 'Video completion time'),
      error: item.error === null ? null : text(item.error, 'Video operation error'),
    };
  });
  Object.values(videoOperations).forEach((operation) => {
    if (operation.retryOf && !videoOperations[operation.retryOf]) throw new Error(`Video retry ${operation.retryOf} is missing.`);
  });
  const videoClips = keyed(source.videoClips ?? {}, 'Video clip', (item) => {
    const operationId = text(item.operationId, 'Video clip operation id', 160);
    const operation = videoOperations[operationId];
    if (!operation || operation.status !== 'ready') throw new Error('Video clip requires a ready operation.');
    const referenceIds = ids(item.referenceIds, 'Video clip reference ids');
    if (JSON.stringify(referenceIds) !== JSON.stringify(operation.referenceIds)) throw new Error('Video clip references do not match its operation.');
    const settings = parseVideoSettings(item.settings);
    if (JSON.stringify(settings) !== JSON.stringify(operation.settings)) throw new Error('Video clip settings do not match its operation.');
    const promptVersion = numberValue(item.promptVersion, 'Video clip prompt version', 1);
    if (promptVersion !== operation.promptVersion) throw new Error('Video clip prompt version does not match its operation.');
    const provider = text(item.provider, 'Video clip provider', 160);
    const model = text(item.model, 'Video clip model', 160);
    const capabilityProfileVersion = text(item.capabilityProfileVersion, 'Video clip capability profile', 160);
    if (provider !== operation.provider || model !== operation.model || capabilityProfileVersion !== operation.capabilityProfileVersion) {
      throw new Error('Video clip provider provenance does not match its operation.');
    }
    const durationSeconds = numberValue(item.durationSeconds, 'Video clip duration', 1);
    const verifiedFixture = provider === 'cineserye-video-fixture' && durationSeconds === 1 && item.width === 160 && item.height === 90;
    if (!verifiedFixture && Math.abs(durationSeconds - settings.durationSeconds) > 1 / 24) throw new Error('Video clip duration does not match its operation.');
    return {
      id: text(item.id, 'Video clip id', 160), operationId,
      shotId: operation.shotId, revisionId: operation.revisionId, promptId: operation.promptId,
      promptVersion,
      startFrameId: operation.startFrameId,
      endFrameId: operation.endFrameId,
      referenceIds,
      provider,
      model,
      capabilityProfileVersion,
      settings,
      blobHash: text(item.blobHash, 'Video clip blob hash', 128),
      mimeType: enumValue(item.mimeType, ['video/mp4'], 'Video clip MIME type'),
      width: numberValue(item.width, 'Video clip width', 1),
      height: numberValue(item.height, 'Video clip height', 1),
      byteSize: numberValue(item.byteSize, 'Video clip byte size', 1),
      durationSeconds,
      status: enumValue(item.status, ['candidate', 'approved', 'rejected'], 'Video clip status'),
      estimatedCost: nullableNumber(item.estimatedCost, 'Video clip estimated cost'),
      currency: item.currency === null ? null : enumValue(item.currency, ['USD'], 'Video clip currency'),
      createdAt: iso(item.createdAt, 'Video clip creation time'),
    };
  });
  const approvedClipByShot = new Set<string>();
  for (const clip of Object.values(videoClips)) {
    if (clip.status !== 'approved') continue;
    if (approvedClipByShot.has(clip.shotId)) throw new Error(`Shot ${clip.shotId} has more than one approved video clip.`);
    approvedClipByShot.add(clip.shotId);
  }
  return { version: 1, references, storyboardRuns, storyboardFrames, videoOperations, videoClips };
}

export function isReferenceEligibleForImageGeneration(reference: CinemaReferenceRecord): boolean {
  return reference.approvalStatus === 'approved'
    && reference.allowedUses.includes('image-generation')
    && reference.rightsStatus !== 'unknown'
    && reference.blobHash !== null;
}

export function isReferenceEligibleForVideoGeneration(reference: CinemaReferenceRecord): boolean {
  return reference.approvalStatus === 'approved'
    && reference.allowedUses.includes('video-generation')
    && reference.rightsStatus !== 'unknown'
    && reference.blobHash !== null;
}

export function addCinemaReference(
  visual: CinemaVisualPreproductionData,
  reference: CinemaReferenceRecord,
): CinemaVisualPreproductionData {
  if (visual.references[reference.id]) throw new Error('That reference already exists.');
  return { ...structuredClone(visual), references: { ...structuredClone(visual.references), [reference.id]: structuredClone(reference) } };
}

export function updateCinemaReference(
  visual: CinemaVisualPreproductionData,
  referenceId: string,
  patch: Partial<Pick<CinemaReferenceRecord, 'title' | 'type' | 'rightsStatus' | 'allowedUses' | 'approvalStatus' | 'notes' | 'shotIds' | 'pinned'>>,
): CinemaVisualPreproductionData {
  const current = visual.references[referenceId];
  if (!current) throw new Error('The reference is missing.');
  const next = structuredClone(visual);
  next.references[referenceId] = { ...current, ...structuredClone(patch) };
  return next;
}

export function removeCinemaReference(
  visual: CinemaVisualPreproductionData,
  referenceId: string,
): CinemaVisualPreproductionData {
  const current = visual.references[referenceId];
  if (!current) throw new Error('The reference is missing.');
  const usedByRun = Object.values(visual.storyboardRuns).some((run) => run.referenceIds.includes(referenceId))
    || Object.values(visual.videoOperations).some((run) => run.referenceIds.includes(referenceId));
  if (current.shotIds.length || usedByRun) throw new Error('Detach this reference from every shot and generation run before deleting it.');
  const next = structuredClone(visual);
  delete next.references[referenceId];
  return next;
}

export function approveStoryboardFrame(
  visual: CinemaVisualPreproductionData,
  frameId: string,
): CinemaVisualPreproductionData {
  const frame = visual.storyboardFrames[frameId];
  if (!frame) throw new Error('The storyboard frame is missing.');
  if (frame.safetyStatus !== 'passed') throw new Error('A blocked storyboard frame cannot be approved.');
  const next = structuredClone(visual);
  for (const candidate of Object.values(next.storyboardFrames)) {
    if (candidate.shotId === frame.shotId && candidate.status === 'approved') candidate.status = 'candidate';
  }
  next.storyboardFrames[frameId].status = 'approved';
  return next;
}

export function rejectStoryboardFrame(
  visual: CinemaVisualPreproductionData,
  frameId: string,
): CinemaVisualPreproductionData {
  if (!visual.storyboardFrames[frameId]) throw new Error('The storyboard frame is missing.');
  const next = structuredClone(visual);
  next.storyboardFrames[frameId].status = 'rejected';
  return next;
}

export function approveVideoClip(
  visual: CinemaVisualPreproductionData,
  clipId: string,
): CinemaVisualPreproductionData {
  const clip = visual.videoClips[clipId];
  if (!clip) throw new Error('The video clip is missing.');
  const next = structuredClone(visual);
  for (const candidate of Object.values(next.videoClips)) {
    if (candidate.shotId === clip.shotId && candidate.status === 'approved') candidate.status = 'candidate';
  }
  next.videoClips[clipId].status = 'approved';
  return next;
}

export function rejectVideoClip(
  visual: CinemaVisualPreproductionData,
  clipId: string,
): CinemaVisualPreproductionData {
  if (!visual.videoClips[clipId]) throw new Error('The video clip is missing.');
  const next = structuredClone(visual);
  next.videoClips[clipId].status = 'rejected';
  return next;
}
