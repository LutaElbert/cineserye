import { describe, expect, it } from 'vitest';
import { createStoryStarterDocument } from './story-starter';
import { initialDocument } from './initial-document';
import { validateEditorDocument } from './document-file';
import { ensureStoryProject, storyPremise } from './story-development-commands';

describe('explicit idea-only starter', () => {
  it('contains only one empty Story node, no edges, scenes, samples or generated media', () => {
    const document = createStoryStarterDocument(123);
    expect(document.nodes).toHaveLength(1);
    expect(document.nodes[0].data.domainType).toBe('cinema.story');
    expect(document.edges).toEqual([]);
    expect(document.cinema).toBeUndefined();
    expect(storyPremise(document)?.text).toBe('');
    expect(() => validateEditorDocument(document)).not.toThrow();
    const initialized = ensureStoryProject(document);
    expect(initialized.cinema?.sceneOrder).toEqual([]);
    expect(initialized.cinema?.scenes).toEqual({});
    expect(initialized.cinema?.shots).toEqual({});
    expect(initialized.cinema?.projectNodeId).toBe('story-premise');
  });
  it('never changes the legacy scene starter and returns independent objects', () => {
    const baseline = structuredClone(initialDocument);
    const first = createStoryStarterDocument(), second = createStoryStarterDocument();
    expect(first).toEqual(second);
    first.nodes[0].position.x = 900;
    expect(second.nodes[0].position.x).toBe(130);
    expect(initialDocument).toEqual(baseline);
    expect(initialDocument.nodes).toHaveLength(3);
    expect(initialDocument.edges).toHaveLength(2);
  });
});
