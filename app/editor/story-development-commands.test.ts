import { describe, expect, it, vi } from 'vitest';
import { initialDocument } from './initial-document';
import { ensureStoryProject, changeStory, acceptStoryScenes, storyContextDigest, storySceneContext, inheritedStoryDirection, commitReviewedStoryDocument,
  setStorySceneAllocation, storyAllocationReview, storySessionContextDigest } from './story-development-commands';
import { assistantSourceIdentity } from '../features/story-development/useStoryAssistant';
import { richTextFromPlainText } from './rich-text';
import { requestDigest } from '../domain/cinema/request-digest';
import { StoryCreativeBriefSchema } from '../domain/cinema/story-workflow';
import { validateEditorDocument } from './document-file';

async function pending(mode: 'expand' | 'continue' = 'expand') {
  const document = setStorySceneAllocation(ensureStoryProject(structuredClone(initialDocument)), 'scene-01', 20);
  const digest = await storyContextDigest(document);
  return { digest, document: changeStory(document, (data) => {
    data.briefs.push(StoryCreativeBriefSchema.parse({ version: 1, mode, sourceDigest: digest, premise: 'An abandoned cinema reveals tomorrow.',
      aspectRatio: '16:9', platform: 'short-form', durationSeconds: mode === 'continue' ? 60 : 80, durationScope: mode === 'continue' ? 'new-material' : 'whole-story',
      tone: 'Suspense', ending: 'A choice', constraints: ['No dialogue'], assumptions: [], status: 'approved', answers: [] }));
    data.sessions.push({ id: 'session', operationId: null, mode, anchorSceneId: mode === 'continue' ? 'scene-01' : null,
      stage: 'proposal-review', source: { sourceDigest: digest, briefVersion: 1, bindingRevision: 0, references: [] }, error: null, accepted: [],
      proposals: [1, 2, 3].map((index) => ({ id: `proposal-${index}`, title: `New ${index}`, synopsis: 'A decision raises the stakes.', purpose: 'Story beat', durationSeconds: 20, selected: true })) });
  }) };
}
describe('integrated story domain commands', () => {
  it('registers later manual scenes once without overwriting accepted metadata, geometry or locks', async () => {
    const { document, digest } = await pending();
    const before = structuredClone(document.cinema);
    const node = structuredClone(document.nodes.find((node) => node.id === 'scene-01')!);
    node.id = 'manual-scene-02'; node.data.locked = true;
    document.nodes.push(node);
    const changed = await storyContextDigest(document);
    expect(changed).not.toBe(digest);
    expect(() => acceptStoryScenes(document, 'session', changed, false)).toThrow(/changed/);
    const result = ensureStoryProject(document);
    expect(result.cinema?.scenes['scene-01']).toEqual(before?.scenes['scene-01']);
    expect(result.cinema?.storyWorkflow).toEqual(before?.storyWorkflow);
    expect(result.cinema?.sceneOrder).toEqual(['scene-01', 'manual-scene-02']);
    expect(result.cinema?.multiScene?.sceneOrder).toEqual(result.cinema?.sceneOrder);
    expect(result.nodes).toEqual(validateEditorDocument(document).nodes);
    expect(result.edges).toEqual(validateEditorDocument(document).edges);
    expect(document.cinema).toEqual(before);
    expect(ensureStoryProject(result)).toBe(result);
  });
  it('sends visible manual text without rewriting accepted scene records', () => {
    const document = ensureStoryProject(structuredClone(initialDocument));
    const metadata = structuredClone(document.cinema?.scenes);
    const node = document.nodes.find((node) => node.id === 'scene-01')!;
    if (node.data.kind !== 'concept') throw Error('Expected a scene');
    node.data.label = 'Current title'; node.data.body = richTextFromPlainText('Current synopsis');
    expect(storySceneContext(document)).toEqual([{ id: 'scene-01', title: 'Current title', synopsis: 'Current synopsis' }]);
    expect(storySceneContext(document, ['scene-01'])).toEqual([]);
    expect(document.cinema?.scenes).toEqual(metadata);
  });
  it('keeps the existing mapped-scene fingerprint compatible across this upgrade', async () => {
    const document = ensureStoryProject(structuredClone(initialDocument));
    const scene = document.cinema!.scenes['scene-01'];
    const previous = await requestDigest({ premise: { nodeId: 'story-premise', title: 'Story Premise', text: '' },
      scenes: [{ id: scene.id, title: scene.title, synopsis: scene.synopsis, brief: scene.brief, host: { title: scene.title, text: scene.synopsis } }] });
    expect(await storyContextDigest(document)).toBe(previous);
  });
  it('rejects a changed document while acceptance hashing is pending', async () => {
    const { document } = await pending(); let current = document;
    const commit = vi.fn();
    const result = commitReviewedStoryDocument(() => current, commit, (source, digest) => acceptStoryScenes(source, 'session', digest, false));
    current = changeStory(current, (draft) => { draft.sessions[0].proposals[0].title = 'Newer user edit'; });
    await expect(result).rejects.toThrow(/changed during acceptance/);
    expect(commit).not.toHaveBeenCalled();
  });
  it('ignores a fresh save timestamp and permits only one overlapping acceptance', async () => {
    const { document } = await pending(); let current = document; let timestamp = 0;
    const commit = vi.fn((value) => { current = value; });
    const get = () => ({ ...current, updatedAt: timestamp++ });
    const apply = (source: typeof document, digest: string) => acceptStoryScenes(source, 'session', digest, false);
    const results = await Promise.allSettled([commitReviewedStoryDocument(get, commit, apply), commitReviewedStoryDocument(get, commit, apply)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(commit).toHaveBeenCalledTimes(1); expect(current.nodes).toHaveLength(6);
  });
  it('initializes semantic records without changing existing canvas content', () => {
    const result = ensureStoryProject(initialDocument);
    expect(result.nodes).toEqual(validateEditorDocument(initialDocument).nodes); expect(result.edges).toEqual(validateEditorDocument(initialDocument).edges);
    expect(result.cinema?.sceneOrder).toEqual(['scene-01']);
  });
  it('accepts one validated batch preserving hosts and allocation provenance', async () => {
    const { document, digest } = await pending();
    const accepted = acceptStoryScenes(document, 'session', digest, false);
    expect(accepted.nodes.slice(0, 3)).toEqual(document.nodes);
    expect(accepted.cinema?.sceneOrder).toEqual(['scene-01', 'session:proposal-1', 'session:proposal-2', 'session:proposal-3']);
    expect(inheritedStoryDirection(accepted, 'session:proposal-1')?.allocation).toBe(20);
    expect(validateEditorDocument(accepted)).toEqual(accepted);
    expect(() => acceptStoryScenes(accepted, 'session', digest, false)).toThrow(/available/);
  });
  it('rejects stale and unconfirmed partial acceptance without changing source', async () => {
    const { document, digest } = await pending();
    const before = structuredClone(document);
    expect(() => acceptStoryScenes(document, 'session', 'b'.repeat(64), false)).toThrow(/changed/);
    expect(document).toEqual(before);
    const partial = changeStory(document, (data) => { data.sessions[0].proposals[0].selected = false; });
    expect(() => acceptStoryScenes(partial, 'session', digest, false)).toThrow(/allocated/);
    expect(acceptStoryScenes(partial, 'session', digest, true).nodes).toHaveLength(5);
  });
  it('inserts continuation after the chosen anchor and never moves a locked parent', async () => {
    const { document, digest } = await pending('continue'); document.nodes[0].data.locked = true;
    const result = acceptStoryScenes(document, 'session', digest, false);
    expect(result.nodes[0]).toEqual(validateEditorDocument(document).nodes[0]); expect(result.cinema?.sceneOrder[1]).toBe('session:proposal-1');
  });
  it('invalidates proposals for manual scene text changes, not canvas movement', async () => {
    const { document, digest } = await pending();
    document.nodes[1].position.x += 200;
    expect(await storyContextDigest(document)).toBe(digest);
    const scene = document.nodes.find((node) => node.id === 'scene-01')!;
    if (scene.data.kind === 'concept') scene.data.label = 'Changed scene';
    const changed = await storyContextDigest(document);
    expect(changed).not.toBe(digest);
    expect(() => acceptStoryScenes(document, 'session', changed, false)).toThrow(/changed/);
  });
  it('counts existing material toward a whole-story target and does not call 80 seconds 60', async () => {
    const { document } = await pending();
    const brief = { ...document.cinema!.storyWorkflow!.briefs[0], durationSeconds: 60 };
    const review = storyAllocationReview(document, brief, 'session');
    expect(review).toMatchObject({ existingSeconds: 20, targetSeconds: 60, remainingSeconds: 40,
      newSelectedSeconds: 60, resultingSeconds: 80, requiresPartialConfirmation: true });
    expect(storyAllocationReview(document, { ...brief, durationSeconds: 20 }).blockers[0]).toMatch(/met or exceeded/);
    expect(storyAllocationReview(document, { ...brief, durationSeconds: 10 }).remainingSeconds).toBe(-10);
  });
  it('keeps manual unknown allocations unknown and permits only explicitly new-material scope', async () => {
    const { document } = await pending();
    const unknown = changeStory(document, (workflow) => { workflow.allocations = []; });
    const brief = unknown.cinema!.storyWorkflow!.briefs[0];
    expect(storyAllocationReview(unknown, brief)).toMatchObject({ existingSeconds: null, resultingSeconds: null, remainingSeconds: null, unknownSceneIds: ['scene-01'] });
    expect(storyAllocationReview(unknown, brief).blockers).toHaveLength(1);
    const continuation = storyAllocationReview(unknown, { ...brief, mode: 'continue', durationScope: 'new-material' });
    expect(continuation.remainingSeconds).toBe(80); expect(continuation.existingSeconds).toBeNull(); expect(continuation.blockers).toEqual([]);
  });
  it('accepts saved remaining drafts later without duplicate IDs and recomputes target remainder', async () => {
    const { document, digest } = await pending();
    const partial = changeStory(document, (workflow) => { workflow.sessions[0].proposals[1].selected = false; });
    const first = acceptStoryScenes(partial, 'session', digest, true);
    expect(first.cinema!.storyWorkflow!.sessions[0]).toMatchObject({ stage: 'proposal-review', presentation: 'scenes-added' });
    expect(first.cinema!.storyWorkflow!.sessions[0].accepted).toHaveLength(2);
    expect(await storySessionContextDigest(first, 'session')).toBe(digest);
    const review = storyAllocationReview(first, first.cinema!.storyWorkflow!.briefs[0], 'session');
    expect(review).toMatchObject({ existingSeconds: 60, remainingSeconds: 20, newSelectedSeconds: 0 });
    const remainder = changeStory(first, (workflow) => { workflow.sessions[0].proposals[1].selected = true; workflow.sessions[0].presentation = 'scene-review'; });
    const result = acceptStoryScenes(remainder, 'session', await storySessionContextDigest(remainder, 'session'), false);
    expect(result.cinema!.sceneOrder).toEqual(['scene-01', 'session:proposal-1', 'session:proposal-2', 'session:proposal-3']);
    expect(result.cinema!.storyWorkflow!.sessions[0].accepted).toHaveLength(3);
    expect(result.cinema!.storyWorkflow!.sessions[0].stage).toBe('accepted');
    expect(result.nodes.filter((node) => first.nodes.some((old) => old.id === node.id))).toEqual(first.nodes);
    expect(() => acceptStoryScenes(result, 'session', digest, false)).toThrow(/available/);
  });
  it('preserves the exact continuation anchor order across multiple acceptance batches', async () => {
    const { document, digest } = await pending('continue');
    const partial = changeStory(document, (workflow) => { workflow.sessions[0].proposals[0].selected = false; });
    const first = acceptStoryScenes(partial, 'session', digest, true);
    const rest = changeStory(first, (workflow) => { workflow.sessions[0].proposals[0].selected = true; });
    expect(storyAllocationReview(rest, rest.cinema!.storyWorkflow!.briefs[0], 'session')).toMatchObject({ acceptedNewSeconds: 40, remainingSeconds: 20 });
    const result = acceptStoryScenes(rest, 'session', await storySessionContextDigest(rest, 'session'), false);
    expect(result.cinema!.sceneOrder).toEqual(['scene-01', 'session:proposal-1', 'session:proposal-2', 'session:proposal-3']);
  });
  it('keeps one Assistant source after own acceptance but invalidates edited/deleted output', async () => {
    const { document, digest } = await pending();
    const withAssistant = changeStory(document, (workflow) => {
      workflow.version = 2;
      workflow.assistant = { version: 1, id: 'assistant', premiseNodeId: 'story-premise', position: { x: 800, y: 300 }, hidden: false, collapsed: false,
        sourceDigest: null, operationId: null, state: 'confirmed', checkpoint: null, answers: [], confirmedBriefVersion: 1, error: null };
      workflow.sessions[0].proposals[1].selected = false;
    });
    const beforeIdentity = assistantSourceIdentity(withAssistant);
    const accepted = acceptStoryScenes(withAssistant, 'session', digest, true);
    expect(assistantSourceIdentity(accepted)).toBe(beforeIdentity);
    const edited = structuredClone(accepted);
    const host = edited.nodes.find((node) => node.id === 'session:proposal-1')!;
    if (host.data.kind === 'concept') host.data.label = 'An external edit';
    expect(assistantSourceIdentity(edited)).not.toBe(beforeIdentity);
    expect(await storySessionContextDigest(edited, 'session')).not.toBe(digest);
    const deleted = structuredClone(accepted); deleted.nodes = deleted.nodes.filter((node) => node.id !== 'session:proposal-1');
    expect(assistantSourceIdentity(deleted)).not.toBe(beforeIdentity);
    expect(await storySessionContextDigest(deleted, 'session')).not.toBe(digest);
  });
  it('protects locked scene allocations and invalidates review after an explicit allocation edit', async () => {
    const { document, digest } = await pending();
    const updated = setStorySceneAllocation(document, 'scene-01', 30);
    expect(await storyContextDigest(updated)).not.toBe(digest);
    const locked = structuredClone(document); locked.nodes.find((node) => node.id === 'scene-01')!.data.locked = true;
    expect(() => setStorySceneAllocation(locked, 'scene-01', 30)).toThrow(/Unlock/);
    expect(() => setStorySceneAllocation(document, 'scene-01', 0)).toThrow(/positive/);
  });
});
