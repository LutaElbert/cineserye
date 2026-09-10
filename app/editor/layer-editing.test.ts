import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { ensureStoryProject, changeStory, storyContextDigest } from './story-development-commands';
import { editLayerText, editLayerShot, layerEditTarget, syncPremiseDraft } from './layer-editing';
import { applyCanvasCommandProposal } from './canvas-commands';
import { MOCK_CINEMA_PROJECT_DATA, MOCK_SHOT_PLAN_PROPOSAL } from '../domain/cinema/mock/reel-knows-tomorrow';
import { richTextToPlainText } from './rich-text';

describe('focused layer editing', () => {
  it('changes text without changing geometry, edges, or the original document', () => {
    const source = ensureStoryProject(structuredClone(initialDocument));
    const next = editLayerText(source, 'scene-01', { title: 'Arrival', body: 'She arrives.' });
    expect(next.cinema?.scenes['scene-01']).toMatchObject({ title: 'Arrival', synopsis: 'She arrives.' });
    expect(next.nodes.map((node) => [node.position, node.style])).toEqual(source.nodes.map((node) => [node.position, node.style]));
    expect(next.edges).toEqual(source.edges);
    expect(source.cinema?.scenes['scene-01'].title).toBe('Scene 01');
  });
  it('synchronizes an explicit premise draft edit and invalidates the source digest', async () => {
    const source = changeStory(ensureStoryProject(structuredClone(initialDocument)), (data) => {
      data.draft = { mode: 'expand', premise: 'Old', answers: [], anchorSceneId: null, durationSeconds: 60, aspectRatio: '16:9', tone: 'Suspense', ending: '', constraints: [] };
    });
    const next = syncPremiseDraft(source, 'New premise');
    expect(next.cinema?.storyWorkflow?.draft?.premise).toBe('New premise');
    const story = next.nodes[0];
    expect(story.data.kind === 'concept' && richTextToPlainText(story.data.body)).toBe('New premise');
    expect(await storyContextDigest(next)).not.toBe(await storyContextDigest(source));
    expect(next.cinema?.storyWorkflow?.briefs).toEqual(source.cinema?.storyWorkflow?.briefs);
  });
  it('inspects a locked manual layer but rejects mutations', () => {
    const source = structuredClone(initialDocument); source.nodes[1].data.locked = true;
    expect(layerEditTarget(source, 'scene-01')?.readOnly).toBe(true);
    expect(() => editLayerText(source, 'scene-01', { title: 'No' })).toThrow('Unlock');
  });
  it('edits accepted shots through domain commands, preserving locks and history', () => {
    const source = { ...applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
    const shot = Object.values(source.cinema.shots)[0];
    const next = editLayerShot(source, shot.nodeId, { cameraMovement: 'Slow push', durationSeconds: 8 });
    expect(next.cinema?.shots[shot.id].cameraMovement).toBe('Slow push');
    expect(next.cinema?.revisions).toEqual(source.cinema.revisions);
    expect(next.nodes.find((node) => node.id === shot.nodeId)?.data.locked).toBe(true);
    expect(() => editLayerShot(source, shot.nodeId, { durationSeconds: -1 })).toThrow();
    expect(next.cinema?.prompts && Object.values(next.cinema.prompts).filter((prompt) => prompt.ownerNodeId === shot.nodeId).every((prompt) => prompt.status === 'stale')).toBe(true);
  });
  it('does not overwrite divergent historical drafts just by resolving a layer', () => {
    const source = ensureStoryProject(structuredClone(initialDocument)); const before = structuredClone(source);
    layerEditTarget(source, 'story-premise'); expect(source).toEqual(before);
    expect(() => editLayerText(source, 'scene-01', { title: 'Two\nlines' })).toThrow();
    expect(() => editLayerText(source, 'scene-01', { body: 'x'.repeat(20_001) })).toThrow();
  });
});
