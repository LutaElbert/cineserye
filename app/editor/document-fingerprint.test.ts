import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { cinemaSourceFingerprint, legacyCinemaSourceFingerprint } from './document-fingerprint';
import { createEmptyVisualPreproductionData } from '../domain/cinema/visual-preproduction';
import { MOCK_CINEMA_PROJECT_DATA, MOCK_SHOT_PLAN_PROPOSAL } from '../domain/cinema/mock/reel-knows-tomorrow';
import { applyCanvasCommandProposal } from './canvas-commands';

describe('cinema source fingerprint', () => {
  it('ignores transient selection and timestamps but changes with source content', () => {
    const transient = structuredClone(initialDocument);
    transient.updatedAt += 100;
    transient.nodes[0].selected = true;
    expect(cinemaSourceFingerprint(transient)).toBe(cinemaSourceFingerprint(initialDocument));
    transient.nodes[0].data.name = 'Changed premise';
    expect(cinemaSourceFingerprint(transient)).not.toBe(cinemaSourceFingerprint(initialDocument));
  });
  it('excludes navigation and operation observations while retaining creative output', () => {
    const source = { ...applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document,
      cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    source.cinema.visualPreproduction = createEmptyVisualPreproductionData();
    const shot = Object.values(source.cinema.shots)[0];
    const revision = Object.values(source.cinema.revisions).find(value => value.sceneId === shot.sceneId && value.status === 'active')!;
    const imagePrompt = Object.values(source.cinema.prompts).find(value => value.ownerNodeId === shot.nodeId && value.purpose === 'storyboard')!;
    const videoPrompt = Object.values(source.cinema.prompts).find(value => value.ownerNodeId === shot.nodeId && value.purpose === 'video')!;
    source.cinema.visualPreproduction.storyboardRuns.run = { id: 'run', shotId: shot.id, revisionId: revision.id,
      promptId: imagePrompt.id, promptVersion: imagePrompt.version, referenceIds: [], provider: 'provider', model: 'model',
      aspectRatio: '9:16', outputCount: 1, intent: 'balanced', estimatedCost: 0, currency: 'USD', status: 'completed',
      consentedAt: '2026-09-11T00:00:00.000Z', startedAt: '2026-09-11T00:00:00.000Z', completedAt: '2026-09-11T00:00:01.000Z', error: null };
    source.cinema.visualPreproduction.storyboardFrames.frame = { id: 'frame', runId: 'run', shotId: shot.id, revisionId: revision.id,
      promptId: imagePrompt.id, promptVersion: imagePrompt.version, promptText: imagePrompt.generatedText, referenceIds: [], provider: 'provider', model: 'model',
      aspectRatio: '9:16', seed: 1, variantIndex: 0, intent: 'balanced', blobHash: 'a'.repeat(64), mimeType: 'image/png', width: 1, height: 1,
      byteSize: 1, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: '2026-09-11T00:00:01.000Z' };
    const before = cinemaSourceFingerprint(source);
    source.cinema.activeSceneId = null;
    source.cinema.activeRevisionId = null;
    source.cinema.visualPreproduction.videoOperations.operation = {
      id: 'operation', shotId: shot.id, revisionId: revision.id, promptId: videoPrompt.id, promptVersion: videoPrompt.version, promptText: videoPrompt.generatedText,
      negativeConstraints: [], startFrameId: 'frame', startFrameApproval: 'approved', endFrameId: null, endFrameApproval: null,
      referenceIds: [], provider: 'provider', model: 'model', capabilityProfileVersion: '1',
      settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null },
      estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'running', retryOf: null,
      consentedAt: '2026-09-11T00:00:00.000Z', startedAt: '2026-09-11T00:00:00.000Z', completedAt: null, error: null,
    };
    expect(cinemaSourceFingerprint(source)).toBe(before);
    source.cinema.visualPreproduction.videoOperations.operation.status = 'unknown';
    source.cinema.visualPreproduction.videoOperations.operation.error = 'Disconnected';
    expect(cinemaSourceFingerprint(source)).toBe(before);
    source.title = 'Creative title';
    expect(cinemaSourceFingerprint(source)).not.toBe(before);
  });
  it('keeps the legacy algorithm available only for existing pending proposal recovery', () => {
    const source = structuredClone(initialDocument);
    expect(legacyCinemaSourceFingerprint(source)).toMatch(/^[a-f0-9]{8}$/);
    expect(cinemaSourceFingerprint(source)).toBe(legacyCinemaSourceFingerprint(source));
  });
});
