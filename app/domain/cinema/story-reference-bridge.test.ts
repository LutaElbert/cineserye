import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { updateStoryWorkflow, reviseStoryReference } from './story-workflow';
import { storyImageReferences, storyReferenceSnapshot } from './story-reference-bridge';

describe('story references at the existing image boundary', () => {
  it('inherits approved images with immutable version identities without duplicating library data', () => {
    const base = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const shot = Object.values(base.shots)[0];
    const project = updateStoryWorkflow(base, 0, (draft) => {
      draft.references.push({ id: 'visual:guide', versions: [{ version: 1, title: 'Visual guide', category: 'style', provenance: 'Creator',
        content: { kind: 'image', blobHash: 'a'.repeat(64), mimeType: 'image/png', width: 20, height: 20, byteSize: 100 },
        rights: 'creator-owned', approval: 'approved', allowedUses: ['image-generation'], archived: false }] });
      draft.bindings.push({ owner: { kind: 'story', id: base.projectId }, rules: [{ action: 'add', referenceId: 'visual:guide' }] });
    });
    const before = structuredClone(project);
    const images = storyImageReferences(project, shot.id);
    expect(images.map((image) => image.id)).toEqual(['story-ref:visual:guide:v1']);
    expect(project).toEqual(before);
    const revoked = reviseStoryReference(project, 1, 'visual:guide', { approval: 'revoked' });
    expect(storyImageReferences(revoked, shot.id)).toEqual([]);
    expect(storyReferenceSnapshot(revoked.storyWorkflow, images[0].id)?.approval).toBe('approved');
    expect(storyReferenceSnapshot(revoked.storyWorkflow, 'story-ref:visual:guide:v999')).toBeUndefined();
    const excluded = updateStoryWorkflow(project, 1, (draft) => {
      draft.bindings.push({ owner: { kind: 'scene', id: shot.sceneId }, rules: [{ action: 'exclude', referenceId: 'visual:guide' }] });
    });
    expect(storyImageReferences(excluded, shot.id)).toEqual([]);
  });
});
