import { describe, expect, it } from 'vitest';
import { createEmptyCinemaProjectData } from '../../domain/cinema/project-data';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { emptyStoryWorkflow } from '../../domain/cinema/story-workflow';
import { createEmptyVisualPreproductionData, type CinemaStoryboardFrameRecord, type CinemaVideoClipRecord } from '../../domain/cinema/visual-preproduction';
import type { ClientOperationEntry } from './operation-journal';
import { projectStageProjection } from './stage-projection';

function operation(overrides: Partial<ClientOperationEntry> = {}): ClientOperationEntry {
  return { version: 1, id: 'operation-1', projectId: 'project', kind: 'video-generation', scopeKey: 'scene:shot:revision',
    sourceFingerprint: 'a'.repeat(64), provider: 'fixture', model: 'fixture', estimateUsd: 0,
    createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z', phase: 'running',
    dispatchCertainty: 'may-have-dispatched', lastError: null, completedUnits: null, totalUnits: null, ...overrides };
}

function oneShot() {
  const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  const scene = cinema.scenes[cinema.sceneOrder[0]];
  cinema.sceneOrder = [scene.id];
  scene.shotIds = [scene.shotIds[0]];
  const shot = cinema.shots[scene.shotIds[0]];
  const revision = Object.values(cinema.revisions).find(value => value.sceneId === scene.id && value.status === 'active')!;
  const imagePrompt = Object.values(cinema.prompts).find(value => value.ownerNodeId === shot.nodeId && value.purpose === 'storyboard')!;
  const videoPrompt = Object.values(cinema.prompts).find(value => value.ownerNodeId === shot.nodeId && value.purpose === 'video')!;
  cinema.visualPreproduction = createEmptyVisualPreproductionData();
  const frame = { id: 'frame', runId: 'run', shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id, promptVersion: imagePrompt.version,
    status: 'candidate', safetyStatus: 'passed', createdAt: '2026-09-11T01:00:00Z', blobHash: 'b'.repeat(64) } as CinemaStoryboardFrameRecord;
  const clip = { id: 'clip', operationId: 'video', shotId: shot.id, revisionId: revision.id, promptId: videoPrompt.id,
    promptVersion: videoPrompt.version, startFrameId: frame.id, status: 'candidate', createdAt: '2026-09-11T02:00:00Z',
    blobHash: 'c'.repeat(64) } as CinemaVideoClipRecord;
  return { cinema, scene, shot, frame, clip };
}

describe('five-stage document projection', () => {
  it('starts an empty document in Idea without treating open or typing as generation', () => {
    const result = projectStageProjection({ hasPremise: false });
    expect(result.recommendedStage).toBe('idea');
    expect(result.guidance.idea).toMatchObject({ state: 'empty', action: { kind: 'open-story-editor', label: 'Write your idea' } });
    expect(result.guidance.plan.action).toMatchObject({ kind: 'open-story-assistant', label: 'Review scene request' });
  });

  it('names the first scene missing a shot plan and never depends on canvas selection', () => {
    const { cinema, scene } = oneShot(); scene.shotIds = [];
    const result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.plan).toMatchObject({ state: 'missing-shot-plan',
      action: { kind: 'open-scene', targetId: scene.nodeId, label: `Review shot plan for ${scene.title}` } });
  });

  it('does not send an existing accepted legacy project back through onboarding', () => {
    const { cinema } = oneShot();
    const result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.idea.state).toBe('direction-reviewed');
    expect(result.guidance.plan.state).toBe('plans-accepted');
    expect(result.recommendedStage).toBe('references');
  });

  it('keeps proposal and partial-acceptance guidance on the exact review state', () => {
    const cinema = createEmptyCinemaProjectData('project');
    cinema.storyWorkflow = emptyStoryWorkflow();
    cinema.storyWorkflow.sessions.push({ id: 'session', operationId: 'operation', mode: 'expand', anchorSceneId: null,
      stage: 'proposal-review', source: { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: 0, references: [] },
      proposals: [
        { id: 'proposal-1', title: 'First', synopsis: 'First scene', purpose: 'Opening', durationSeconds: 10, selected: true },
        { id: 'proposal-2', title: 'Second', synopsis: 'Second scene', purpose: 'Ending', durationSeconds: 10, selected: true },
      ], accepted: [], error: null });
    cinema.storyWorkflow.reviewSessionId = 'session';
    let result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.idea).toMatchObject({ state: 'proposed-scenes', title: 'Scene proposals are ready', action: { label: 'Review proposed scenes' } });
    cinema.storyWorkflow.sessions[0].accepted.push({ proposalId: 'proposal-1', sceneId: 'scene-1' });
    result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.idea).toMatchObject({ state: 'partial-scenes', title: 'Some scene drafts remain', action: { label: 'Review remaining drafts' } });
  });

  it('moves current image candidates and approved frames through References without promoting candidates', () => {
    const { cinema, shot, frame } = oneShot();
    cinema.visualPreproduction!.storyboardFrames[frame.id] = frame;
    let result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.references).toMatchObject({ state: 'candidate-images', action: { kind: 'open-shot', targetId: shot.nodeId } });
    expect(result.guidance.video.state).toBe('reference-needed');
    frame.status = 'approved';
    result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.references.state).toBe('references-approved');
    expect(result.guidance.video).toMatchObject({ state: 'missing-take', action: { kind: 'open-shot', targetId: shot.nodeId } });
  });

  it('requires explicit take review before the sequence becomes ready', () => {
    const { cinema, shot, frame, clip } = oneShot(); frame.status = 'approved';
    cinema.visualPreproduction!.storyboardFrames[frame.id] = frame;
    cinema.visualPreproduction!.videoClips[clip.id] = clip;
    let result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.video).toMatchObject({ state: 'take-candidate', action: { label: 'Review take', targetId: shot.nodeId } });
    expect(result.guidance['final-cut'].state).toBe('partial-sequence');
    clip.status = 'approved';
    result = projectStageProjection({ cinema, hasPremise: true });
    expect(result.guidance.video.state).toBe('takes-approved');
    expect(result.guidance['final-cut']).toMatchObject({ state: 'sequence-ready', action: { kind: 'none', label: 'Render silent MP4' } });
  });

  it.each([
    ['unknown', 'outcome-unknown', 'Check existing request'],
    ['tracking-stopped', 'tracking-stopped', 'Review existing request'],
    ['failed', 'failed', 'Review retry eligibility'],
    ['expired', 'expired', 'Review unavailable result'],
    ['running', 'running', 'View existing request'],
  ] as const)('gives %s operation uncertainty priority over new video generation', (phase, state, label) => {
    const { cinema, shot, frame } = oneShot(); frame.status = 'approved'; cinema.visualPreproduction!.storyboardFrames[frame.id] = frame;
    const entry = operation({ phase, projectId: cinema.projectId, scopeKey: `${shot.sceneId}:${shot.id}:revision`,
      lastError: phase === 'failed' ? 'Terminal failure.' : null });
    expect(projectStageProjection({ cinema, hasPremise: true, operations: [entry] }).guidance.video)
      .toMatchObject({ state, operationId: entry.id, action: { label, targetId: shot.nodeId } });
  });

  it('treats previous but non-current media as a changed source instead of a new empty shot', () => {
    const { cinema, frame } = oneShot(); frame.status = 'approved'; frame.revisionId = 'old-revision';
    cinema.visualPreproduction!.storyboardFrames[frame.id] = frame;
    expect(projectStageProjection({ cinema, hasPremise: true }).guidance.references)
      .toMatchObject({ state: 'stale-source', action: { label: 'Review changed source' } });
  });

  it('keeps an empty but valid cinema project safe', () => {
    const cinema = createEmptyCinemaProjectData('project');
    const result = projectStageProjection({ cinema, hasPremise: true, capabilityError: true });
    expect(result.guidance.references.state).toBe('no-shots');
    expect(result.guidance.video.state).toBe('no-shots');
    expect(result.guidance['final-cut'].state).toBe('empty-sequence');
  });
});
