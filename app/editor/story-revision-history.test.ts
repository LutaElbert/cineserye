import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { validateEditorDocument } from './document-file';
import { StoryCreativeBriefSchema, storyReviewSession, type StoryWorkflowData } from '../domain/cinema/story-workflow';
import { acceptStoryScenes, changeStory, ensureStoryProject, openStorySessionReview, returnToLatestStorySession,
  setStorySceneAllocation, storyContextDigest, storySessionContextDigest } from './story-development-commands';

async function history() {
  let document = setStorySceneAllocation(ensureStoryProject(structuredClone(initialDocument)), 'scene-01', 20);
  const digest = await storyContextDigest(document);
  document = changeStory(document, (workflow) => {
    workflow.briefs.push(StoryCreativeBriefSchema.parse({ version: 1, mode: 'expand', sourceDigest: digest,
      premise: 'A cinema reveals tomorrow.', aspectRatio: '16:9', platform: 'short-form', durationSeconds: 80,
      durationScope: 'whole-story', tone: 'Suspense', ending: 'Everyone survives', constraints: ['No dialogue'], assumptions: [], status: 'approved', answers: [] }));
    workflow.sessions.push({ id: 'original', operationId: 'original-op', mode: 'expand', anchorSceneId: null,
      stage: 'proposal-review', source: { sourceDigest: digest, briefVersion: 1, bindingRevision: 0, references: [] },
      proposals: [1, 2, 3].map((index) => ({ id: `proposal-${index}`, title: `Scene ${index}`, synopsis: 'A decision.', purpose: 'A beat.', durationSeconds: 20, selected: true })),
      accepted: [], outlineVersion: 1, error: null });
  });
  document = changeStory(document, (workflow) => {
    const revised = structuredClone(workflow.sessions[0]);
    revised.id = 'revision'; revised.operationId = 'revision-op'; revised.outlineVersion = 2;
    revised.proposals[1].synopsis = 'The second scene becomes more tense.';
    revised.revision = { instruction: 'Make Scene 2 more tense; everyone survives.', sourceSessionId: 'original', sourceOperationId: 'original-op',
      selectedProposalIds: ['proposal-2'], sourceVersion: 1, resultVersion: 2, status: 'completed',
      requestedAt: '2026-09-08T00:00:00.000Z', resolvedAt: '2026-09-08T00:00:01.000Z' };
    workflow.sessions.push(revised);
  });
  return { document, digest };
}

describe('saved story revision lineage and local history review', () => {
  it('reopens older unaccepted drafts without reordering history or changing the canvas', async () => {
    const { document } = await history();
    const opened = openStorySessionReview(document, 'original');
    expect(storyReviewSession(opened.cinema!.storyWorkflow)?.id).toBe('original');
    expect(opened.cinema!.storyWorkflow!.sessions.map((item) => item.id)).toEqual(['original', 'revision']);
    expect(opened.nodes).toEqual(document.nodes); expect(opened.edges).toEqual(document.edges);
    expect(opened.cinema!.scenes).toEqual(document.cinema!.scenes);
    expect(storyReviewSession(returnToLatestStorySession(opened).cinema!.storyWorkflow)?.id).toBe('revision');
  });
  it('roundtrips saved selection and exact instruction, scope, versions and status without inventing provenance', async () => {
    const { document } = await history();
    const saved = openStorySessionReview(document, 'original');
    const loaded = validateEditorDocument(JSON.parse(JSON.stringify(saved)));
    expect(loaded.cinema!.storyWorkflow!.reviewSessionId).toBe('original');
    expect(loaded.cinema!.storyWorkflow!.sessions[1].revision).toEqual(document.cinema!.storyWorkflow!.sessions[1].revision);
    expect(loaded.cinema!.storyWorkflow!.sessions[1].revision!.provenance).toBeUndefined();
  });
  it('keeps accepted descendants untouched and blocks stale historical acceptance', async () => {
    const { document, digest } = await history();
    const chosen = changeStory(document, (workflow) => { workflow.sessions[1].proposals[0].selected = false; workflow.sessions[1].proposals[2].selected = false; });
    const accepted = acceptStoryScenes(chosen, 'revision', digest, true);
    const opened = openStorySessionReview(accepted, 'original');
    expect(opened.cinema!.storyWorkflow!.sessions[1]).toEqual(accepted.cinema!.storyWorkflow!.sessions[1]);
    expect(opened.nodes).toEqual(accepted.nodes); expect(opened.edges).toEqual(accepted.edges);
    expect(opened.cinema!.scenes).toEqual(accepted.cinema!.scenes);
    const staleDigest = await storySessionContextDigest(opened, 'original');
    expect(() => acceptStoryScenes(opened, 'original', staleDigest, true)).toThrow(/changed/);
  });
  it('can accept an older reviewed outline while preserving later chronological lineage', async () => {
    const { document, digest } = await history();
    const result = acceptStoryScenes(openStorySessionReview(document, 'original'), 'original', digest, false);
    expect(result.cinema!.storyWorkflow!.sessions.map((item) => item.id)).toEqual(['original', 'revision']);
    expect(result.cinema!.storyWorkflow!.sessions[1].revision).toEqual(document.cinema!.storyWorkflow!.sessions[1].revision);
    expect(result.cinema!.storyWorkflow!.reviewSessionId).toBe('original');
    expect(() => openStorySessionReview(result, 'original')).toThrow(/no reviewable/);
  });
  it('refuses history switching during unresolved work and rejects dangling selection', async () => {
    const { document } = await history();
    for (const stage of ['running', 'outcome-unknown'] as const) {
      const pending = changeStory(document, (workflow) => { workflow.sessions[1].stage = stage; });
      expect(() => openStorySessionReview(pending, 'original')).toThrow(/Resolve the active/);
    }
    expect(() => openStorySessionReview(document, 'missing')).toThrow(/no reviewable/);
    expect(() => changeStory(document, (workflow) => { workflow.reviewSessionId = 'missing'; })).toThrow(/missing session/);
  });
  it('makes request lineage immutable and refuses missing or cyclic parents', async () => {
    const { document } = await history();
    expect(() => changeStory(document, (workflow) => { workflow.sessions[1].revision!.instruction = 'Rewrite all scenes'; })).toThrow(/immutable/);
    expect(() => changeStory(document, (workflow) => { workflow.sessions[1].revision!.status = 'rejected'; })).toThrow(/immutable/);
    const workflow = structuredClone(document.cinema!.storyWorkflow!) as StoryWorkflowData;
    workflow.sessions[1].revision!.sourceSessionId = 'revision';
    expect(() => validateEditorDocument({ ...document, cinema: { ...document.cinema!, storyWorkflow: workflow } })).toThrow(/earlier saved session/);
  });
});
