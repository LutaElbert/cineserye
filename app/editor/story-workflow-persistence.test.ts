import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { createEmptyCinemaProjectData } from '../domain/cinema/project-data';
import { parseProjectBackup, serializeProjectBackup, validateEditorDocument, parseProjectBackupWithMedia } from './document-file';
import { updateStoryWorkflow, reviseStoryReference, type StoryReferenceVersion } from '../domain/cinema/story-workflow';
import { collectMediaHashes } from './media-reachability';

function documentWithReferences() {
  const doc = structuredClone(initialDocument);
  const ref: StoryReferenceVersion = { version: 1, title: 'Cinema', category: 'location',
    content: { kind: 'image', blobHash: 'a'.repeat(64), mimeType: 'image/png', byteSize: 8, width: 1, height: 1 },
    provenance: 'Local upload', rights: 'unknown', approval: 'pending', allowedUses: ['research'], archived: false };
  doc.cinema = updateStoryWorkflow(createEmptyCinemaProjectData(), 0, (draft) => {
    draft.references = [{ id: 'ref-cinema', versions: [ref] }];
    draft.bindings = [{ owner: { kind: 'story', id: 'cineserye-local-project' }, rules: [{ action: 'add', referenceId: 'ref-cinema' }] }];
    draft.draft = { mode: 'expand', premise: 'Tomorrow is projected on the screen.', answers: [], anchorSceneId: null,
      durationSeconds: null, aspectRatio: null, tone: '', ending: '', constraints: [] };
  });
  return doc;
}
describe('story records in existing persistence and history paths', () => {
  it('round-trips complete metadata and unfinished direction without permissions expansion', () => {
    const doc = documentWithReferences();
    const first = parseProjectBackup(serializeProjectBackup(doc));
    const second = parseProjectBackup(serializeProjectBackup(first));
    expect(second.cinema?.storyWorkflow).toEqual(doc.cinema!.storyWorkflow);
    expect(second.cinema?.storyWorkflow?.references[0].versions[0].allowedUses).toEqual(['research']);
    expect(first.nodes.map((node) => node.id)).toEqual(doc.nodes.map((node) => node.id));
  });
  it('retains replaced and archived pixels for current and undo/recovery roots', () => {
    const doc = documentWithReferences();
    const next = { ...doc, cinema: reviseStoryReference(doc.cinema!, 1, 'ref-cinema', {
      content: { kind: 'image', blobHash: 'b'.repeat(64), mimeType: 'image/png', byteSize: 8, width: 1, height: 1 }, archived: true,
    }) };
    const restored = validateEditorDocument(next);
    expect([...collectMediaHashes([restored])].sort()).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
    expect([...collectMediaHashes([doc])]).toEqual(['a'.repeat(64)]);
    expect(doc.cinema!.storyWorkflow!.references[0].versions).toHaveLength(1);
  });
  it('fails portable import before replacing the current document when reference media is missing', async () => {
    const doc = documentWithReferences(); const original = structuredClone(doc);
    await expect(parseProjectBackupWithMedia(serializeProjectBackup(doc))).rejects.toThrow(/missing a story reference image/);
    expect(doc).toEqual(original);
  });
  it('does not silently drop a future nested workflow version', () => {
    const doc = documentWithReferences();
    const future = structuredClone(doc) as unknown as { cinema: { storyWorkflow: { version: number } } };
    future.cinema.storyWorkflow.version = 2;
    expect(() => validateEditorDocument(future)).toThrow();
  });
});
