import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import {
  addCinemaReference,
  approveStoryboardFrame,
  approveVideoClip,
  createEmptyVisualPreproductionData,
  isReferenceEligibleForImageGeneration,
  removeCinemaReference,
  updateCinemaReference,
  validateVisualPreproductionData,
  type CinemaReferenceRecord,
  type CinemaStoryboardFrameRecord,
  type CinemaStoryboardRunRecord,
  type CinemaVideoClipRecord,
  type CinemaVideoOperationRecord,
} from './visual-preproduction';

const sceneId = MOCK_CINEMA_PROJECT_DATA.activeSceneId as string;
const shot = Object.values(MOCK_CINEMA_PROJECT_DATA.shots)[0];
const prompt = Object.values(MOCK_CINEMA_PROJECT_DATA.prompts)
  .find((candidate) => candidate.ownerNodeId === shot.nodeId && candidate.purpose === 'storyboard')!;
const revisionId = MOCK_CINEMA_PROJECT_DATA.activeRevisionId as string;
const videoPrompt = Object.values(MOCK_CINEMA_PROJECT_DATA.prompts)
  .find((candidate) => candidate.ownerNodeId === shot.nodeId && candidate.purpose === 'video')!;

function reference(overrides: Partial<CinemaReferenceRecord> = {}): CinemaReferenceRecord {
  return {
    id: 'reference-1', sceneId, title: 'Mara owned portrait', type: 'character', origin: 'upload',
    mimeType: 'image/png', width: 800, height: 1_000, byteSize: 12_000, blobHash: 'abc123', sourceUrl: null,
    provenance: 'Uploaded by creator', rightsStatus: 'unknown', allowedUses: ['research'], approvalStatus: 'pending',
    notes: '', shotIds: [], pinned: false, createdAt: '2026-09-01T10:00:00.000Z', ...overrides,
  };
}

function run(): CinemaStoryboardRunRecord {
  return {
    id: 'run-storyboard-1', shotId: shot.id, revisionId, promptId: prompt.id, promptVersion: prompt.version,
    referenceIds: ['reference-1'], provider: 'fixture', model: 'fixture-v1', aspectRatio: '9:16', outputCount: 2,
    intent: 'balanced',
    estimatedCost: 0, currency: 'USD', status: 'completed', consentedAt: '2026-09-01T10:00:00.000Z',
    startedAt: '2026-09-01T10:00:00.000Z', completedAt: '2026-09-01T10:00:01.000Z', error: null,
  };
}

function frame(id: string, variantIndex: number, status: CinemaStoryboardFrameRecord['status']): CinemaStoryboardFrameRecord {
  return {
    id, runId: 'run-storyboard-1', shotId: shot.id, revisionId, promptId: prompt.id, promptVersion: prompt.version,
    referenceIds: ['reference-1'], promptText: prompt.generatedText, provider: 'fixture', model: 'fixture-v1',
    aspectRatio: '9:16', seed: variantIndex, variantIndex, intent: 'balanced', blobHash: `hash-${id}`, mimeType: 'image/png',
    width: 768, height: 1_344, byteSize: 20_000, safetyStatus: 'passed', status,
    estimatedCost: 0, currency: 'USD', createdAt: '2026-09-01T10:00:01.000Z',
  };
}

describe('Sprint 3 reference policy', () => {
  it('S3-UT-01 rejects unsupported reference rights and origin states', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference());
    (visual.references['reference-1'] as unknown as { rightsStatus: string }).rightsStatus = 'scraped';
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).toThrow(/rights.*unsupported/i);
  });

  it('S3-UT-02 never infers generation approval from an upload', () => {
    const pending = reference();
    expect(isReferenceEligibleForImageGeneration(pending)).toBe(false);
    const rightsOnly = { ...pending, rightsStatus: 'creator-owned' as const, allowedUses: ['research', 'image-generation'] as const };
    expect(isReferenceEligibleForImageGeneration({ ...rightsOnly, allowedUses: [...rightsOnly.allowedUses] })).toBe(false);
    expect(isReferenceEligibleForImageGeneration({ ...rightsOnly, allowedUses: [...rightsOnly.allowedUses], approvalStatus: 'approved' })).toBe(true);
  });

  it('S3-UT-03 blocks deletion while a reference is attached to a shot', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({ shotIds: [shot.id] }));
    expect(() => removeCinemaReference(visual, 'reference-1')).toThrow(/Detach/);
    const detached = updateCinemaReference(visual, 'reference-1', { shotIds: [] });
    expect(removeCinemaReference(detached, 'reference-1').references).toEqual({});
  });

  it('S3-IT-03 validates rights, use, provenance, and shot relationships', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved', shotIds: [shot.id],
    }));
    expect(validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA).references['reference-1']).toMatchObject({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], shotIds: [shot.id],
    });
  });
});

describe('Sprint 4 storyboard provenance', () => {
  it('retains unspecified storyboard seeds as null and still reads legacy numeric seeds', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference());
    visual.storyboardRuns['run-storyboard-1'] = run();
    visual.storyboardFrames['frame-1'] = { ...frame('frame-1', 0, 'candidate'), seed: null };
    visual.storyboardFrames['frame-2'] = { ...frame('frame-2', 1, 'candidate'), seed: 41001 };
    const frames = validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA).storyboardFrames;
    expect(frames['frame-1'].seed).toBeNull();
    expect(frames['frame-2'].seed).toBe(41001);
  });

  it('S4-UT-01 enforces the provider output count boundary', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved',
    }));
    visual.storyboardRuns['run-storyboard-1'] = { ...run(), outputCount: 5 };
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).toThrow(/between 1 and 4/);
  });

  it('S4-UT-02 preserves exact prompt, model, reference, revision, seed, and cost provenance', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved',
    }));
    visual.storyboardRuns['run-storyboard-1'] = run();
    visual.storyboardFrames['frame-1'] = frame('frame-1', 0, 'candidate');
    const result = validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA).storyboardFrames['frame-1'];
    expect(result).toMatchObject({ revisionId, promptId: prompt.id, promptVersion: prompt.version, referenceIds: ['reference-1'], model: 'fixture-v1', seed: 0, estimatedCost: 0 });
  });

  it('S4-UT-03 permits exactly one approved anchor per shot', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved',
    }));
    visual.storyboardRuns['run-storyboard-1'] = run();
    visual.storyboardFrames['frame-1'] = frame('frame-1', 0, 'approved');
    visual.storyboardFrames['frame-2'] = frame('frame-2', 1, 'candidate');
    const switched = approveStoryboardFrame(visual, 'frame-2');
    expect(switched.storyboardFrames['frame-1'].status).toBe('candidate');
    expect(switched.storyboardFrames['frame-2'].status).toBe('approved');
  });
});

describe('Sprint 5 directed storyboard alternatives', () => {
  it('S5-UT-05 keeps declared intent bounded, provenance-complete, and separate from approval', () => {
    const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
      rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved',
    }));
    visual.storyboardRuns['run-storyboard-1'] = { ...run(), intent: 'budget-conscious' };
    visual.storyboardFrames['frame-1'] = { ...frame('frame-1', 0, 'candidate'), intent: 'budget-conscious' };
    const result = validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA);
    expect(result.storyboardFrames['frame-1']).toMatchObject({ intent: 'budget-conscious', status: 'candidate' });
    (visual.storyboardRuns['run-storyboard-1'] as unknown as { intent: string }).intent = 'imitate-living-director';
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).toThrow(/intent.*unsupported/i);
  });
});

function videoOperation(overrides: Partial<CinemaVideoOperationRecord> = {}): CinemaVideoOperationRecord {
  return {
    id: 'video-operation-1', shotId: shot.id, revisionId, promptId: videoPrompt.id,
    promptVersion: videoPrompt.version, promptText: videoPrompt.generatedText,
    negativeConstraints: [...videoPrompt.negativeConstraints], startFrameId: 'frame-1', startFrameApproval: 'approved', endFrameId: null, endFrameApproval: null,
    referenceIds: [], provider: 'fixture', model: 'fixture-motion-board-v1',
    capabilityProfileVersion: 'fixture-video-v1',
    settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    estimatedCost: 0, currency: 'USD', providerOperationId: 'fixture-provider-operation', status: 'ready',
    retryOf: null, consentedAt: '2026-09-02T10:00:00.000Z', startedAt: '2026-09-02T10:00:00.000Z',
    completedAt: '2026-09-02T10:00:02.000Z', error: null, ...overrides,
  };
}

function videoClip(id: string, status: CinemaVideoClipRecord['status']): CinemaVideoClipRecord {
  return {
    id, operationId: 'video-operation-1', shotId: shot.id, revisionId, promptId: videoPrompt.id,
    promptVersion: videoPrompt.version, startFrameId: 'frame-1', endFrameId: null, referenceIds: [],
    provider: 'fixture', model: 'fixture-motion-board-v1', capabilityProfileVersion: 'fixture-video-v1',
    settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
    blobHash: `hash-${id}`, mimeType: 'video/mp4', width: 720, height: 1280, byteSize: 2_000,
    durationSeconds: 4, status, estimatedCost: 0, currency: 'USD', createdAt: '2026-09-02T10:00:02.000Z',
  };
}

function videoVisual() {
  const visual = addCinemaReference(createEmptyVisualPreproductionData(), reference({
    rightsStatus: 'creator-owned', allowedUses: ['research', 'image-generation'], approvalStatus: 'approved',
  }));
  visual.storyboardRuns['run-storyboard-1'] = run();
  visual.storyboardFrames['frame-1'] = frame('frame-1', 0, 'approved');
  visual.videoOperations['video-operation-1'] = videoOperation();
  return visual;
}

describe('Sprint 6 video provenance and approval', () => {
  it('retains real fixture duration without passing a short sample as live footage', () => {
    const visual = videoVisual();
    visual.videoOperations['video-operation-1'].provider = 'cineserye-video-fixture';
    visual.videoClips['clip-1'] = { ...videoClip('clip-1', 'candidate'), provider: 'cineserye-video-fixture', width: 160, height: 90, durationSeconds: 1 };
    expect(validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA).videoClips['clip-1'].durationSeconds).toBe(1);
    visual.videoOperations['video-operation-1'].provider = 'google-vertex-ai';
    visual.videoClips['clip-1'].provider = 'google-vertex-ai';
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).toThrow(/duration/);
  });
  it('S6-UT-03 resolves clip metadata to an approved frame, shot, revision, and video prompt', () => {
    const visual = videoVisual();
    visual.videoClips['clip-1'] = videoClip('clip-1', 'candidate');
    const result = validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA);
    expect(result.videoClips['clip-1']).toMatchObject({
      shotId: shot.id,
      revisionId,
      promptId: videoPrompt.id,
      startFrameId: 'frame-1',
      status: 'candidate',
    });
  });

  it('requires an independently approved anchor and never auto-approves the clip', () => {
    const visual = videoVisual();
    visual.videoClips['clip-1'] = videoClip('clip-1', 'candidate');
    visual.videoClips['clip-2'] = { ...videoClip('clip-2', 'candidate'), operationId: 'video-operation-2' };
    visual.videoOperations['video-operation-2'] = videoOperation({ id: 'video-operation-2' });
    const approved = approveVideoClip(visual, 'clip-1');
    const switched = approveVideoClip(approved, 'clip-2');
    expect(switched.videoClips['clip-1'].status).toBe('candidate');
    expect(switched.videoClips['clip-2'].status).toBe('approved');
    visual.storyboardFrames['frame-1'].status = 'candidate';
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).not.toThrow();
    (visual.videoOperations['video-operation-1'] as unknown as { startFrameApproval: string }).startFrameApproval = 'pending';
    expect(() => validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA)).toThrow(/approval snapshot/i);
  });

  it('preserves failed and cancelled operation metadata without incomplete clips', () => {
    const visual = videoVisual();
    visual.videoOperations['video-operation-1'] = videoOperation({ status: 'cancelled', completedAt: '2026-09-02T10:00:01.000Z', error: 'Cancelled by creator.' });
    expect(validateVisualPreproductionData(visual, MOCK_CINEMA_PROJECT_DATA).videoOperations['video-operation-1']).toMatchObject({ status: 'cancelled', error: 'Cancelled by creator.' });
  });
});
