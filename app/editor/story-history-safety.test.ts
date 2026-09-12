import { describe, expect, it } from 'vitest';
import { createEmptyCinemaProjectData } from '../domain/cinema/project-data';
import { emptyStoryWorkflow, type StoryWorkflowData } from '../domain/cinema/story-workflow';
import { restoreStoryHistory, STORY_HISTORY_BLOCKED } from './story-history-safety';

function project(stage: StoryWorkflowData['sessions'][number]['stage'] = 'running') {
  const cinema = createEmptyCinemaProjectData('project');
  cinema.storyWorkflow = emptyStoryWorkflow();
  cinema.storyWorkflow.sessions.push({ id: 'session', operationId: 'operation', mode: 'expand', anchorSceneId: null,
    stage, source: { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: 0, references: [] },
    proposals: [], accepted: [], error: null });
  return cinema;
}

describe('Story operation boundary around undo and redo', () => {
  it.each(['running', 'cancelled', 'outcome-unknown'] as const)('does not erase %s requests, including legacy requests without an operation ID', (stage) => {
    for (const operationId of ['operation', null]) {
      const current = project(stage); current.storyWorkflow!.sessions[0].operationId = operationId;
      const before = structuredClone(current);
      const target = structuredClone(current); target.storyWorkflow!.sessions = [];
      expect(() => restoreStoryHistory(current, target)).toThrow(STORY_HISTORY_BLOCKED);
      expect(() => restoreStoryHistory(current, undefined)).toThrow(STORY_HISTORY_BLOCKED);
      expect(() => restoreStoryHistory(current, { ...current, projectId: 'another' })).toThrow(STORY_HISTORY_BLOCKED);
      expect(current).toEqual(before);
      expect(target.storyWorkflow!.sessions).toEqual([]);
    }
  });
  it('restores ordinary creative history without rewinding the observed cancellation', () => {
    const current = project('cancelled'); current.storyWorkflow!.sessions[0].error = 'Stopped locally';
    const target = project('running');
    const restored = restoreStoryHistory(current, target)!;
    expect(restored.storyWorkflow!.sessions[0]).toEqual(current.storyWorkflow!.sessions[0]);
    expect(target.storyWorkflow!.sessions[0].stage).toBe('running');
    expect(restored).not.toBe(target);
  });
  it('refuses changed operation identity, source and finalized snapshots', () => {
    const current = project();
    for (const change of [
      (target: ReturnType<typeof project>) => { target.storyWorkflow!.sessions[0].operationId = 'other'; },
      (target: ReturnType<typeof project>) => { target.storyWorkflow!.sessions[0].source.sourceDigest = 'b'.repeat(64); },
      (target: ReturnType<typeof project>) => { target.storyWorkflow!.sessions[0].stage = 'proposal-review'; },
    ]) {
      const target = structuredClone(current); change(target);
      expect(() => restoreStoryHistory(current, target)).toThrow(STORY_HISTORY_BLOCKED);
    }
  });
  it('leaves ordinary history unchanged when no unresolved request exists', () => {
    const target = project('accepted');
    expect(restoreStoryHistory(undefined, target)).toBe(target);
    expect(restoreStoryHistory(project('failed'), undefined)).toBeUndefined();
  });
  it('carries completed results across undo without resurrecting running or blocking redo', () => {
    const running = project();
    const completed = project('proposal-review');
    completed.storyWorkflow!.sessions[0].proposals = [{ id: 'proposal', title: 'Saved output', synopsis: 'Still needs review', purpose: 'Test', durationSeconds: 10, selected: true }];
    const restored = restoreStoryHistory(completed, running)!;
    expect(restored.storyWorkflow!.sessions[0].stage).toBe('stale');
    expect(restored.storyWorkflow!.sessions[0].proposals).toEqual(completed.storyWorkflow!.sessions[0].proposals);
    expect(restoreStoryHistory(restored, completed)).toEqual(completed);
    expect(running.storyWorkflow!.sessions[0].stage).toBe('running');
  });
  it('does not carry accepted scene insertion into an earlier running snapshot', () => {
    const running = project();
    const accepted = project('accepted');
    accepted.storyWorkflow!.sessions[0].accepted = [{ proposalId: 'proposal', sceneId: 'scene' }];
    const restored = restoreStoryHistory(accepted, running)!;
    expect(restored.storyWorkflow!.sessions[0].accepted).toEqual([]);
    expect(restored.storyWorkflow!.sessions[0].stage).toBe('stale');
  });
});
