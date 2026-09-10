import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { ensureStoryProject, changeStory } from './story-development-commands';
import { editPremiseDraft, initialPremiseDraft } from './premise-draft';
import { richTextToPlainText } from './rich-text';

describe('compact premise draft', () => {
  it('inspects without creating a draft or inventing required answers', () => {
    const source = ensureStoryProject(structuredClone(initialDocument));
    const before = structuredClone(source);
    expect(initialPremiseDraft(source)).toMatchObject({ mode: 'expand', aspectRatio: null, durationSeconds: null, tone: '', answers: [] });
    expect(source).toEqual(before);
  });
  it('explicit goal and text edits preserve geometry, references and approved records', () => {
    const source = ensureStoryProject(structuredClone(initialDocument));
    const next = editPremiseDraft(source, 'story-premise', { mode: 'continue', premise: 'A new chapter.' });
    expect(next.cinema?.storyWorkflow?.draft).toMatchObject({ mode: 'continue', premise: 'A new chapter.' });
    expect(next.nodes.map((node) => [node.position, node.style])).toEqual(source.nodes.map((node) => [node.position, node.style]));
    expect(next.edges).toEqual(source.edges);
    expect(next.nodes[0].data.kind === 'concept' && richTextToPlainText(next.nodes[0].data.body)).toBe('A new chapter.');
    expect(next.cinema?.storyWorkflow?.briefs).toEqual([]);
  });
  it('does not reconcile a historical draft until the creator explicitly chooses text', () => {
    const source = changeStory(ensureStoryProject(structuredClone(initialDocument)), (data) => { data.draft = { ...initialPremiseDraft(initialDocument), premise: 'Historical text' }; });
    const next = editPremiseDraft(source, 'story-premise', { tone: 'Horror' });
    expect(next.nodes).toEqual(source.nodes);
    expect(next.cinema?.storyWorkflow?.draft?.premise).toBe('Historical text');
  });
  it('rejects locked and non-story targets, invalid duration and unknown properties', () => {
    const source = ensureStoryProject(structuredClone(initialDocument));
    expect(() => editPremiseDraft(source, 'scene-01', { tone: 'No' })).toThrow();
    expect(() => editPremiseDraft(source, 'story-premise', { durationSeconds: -1 })).toThrow();
    expect(() => editPremiseDraft(source, 'story-premise', { tone: 'No', script: 'x' } as never)).toThrow();
    source.nodes[0].data.locked = true;
    expect(() => editPremiseDraft(source, 'story-premise', { tone: 'No' })).toThrow('Unlock');
  });
});
