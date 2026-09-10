import { describe, expect, it } from 'vitest';
import { createEmptyCinemaProjectData } from '../../domain/cinema/project-data';
import { emptyStoryWorkflow, reviseStoryReference, updateStoryWorkflow, type StoryReferenceVersion } from '../../domain/cinema/story-workflow';
import { StoryGenresSchema, storyGenreTone } from '../../domain/cinema/story-genres';
import { AssistantInputSchema } from './assistant-contracts';
import { StoryInputSchema } from './contracts';
import { promptImageAliases, resolvePromptReferenceMentions, storyImageAliases, transferredPromptMentionsValid } from './prompt-composer-model';

const image = (title = 'Mara'): StoryReferenceVersion => ({ version: 1, title, category: 'character',
  content: { kind: 'image', blobHash: 'a'.repeat(64), mimeType: 'image/png', width: 1, height: 1, byteSize: 12 },
  provenance: 'Local upload', rights: 'creator-owned', approval: 'approved', allowedUses: ['story-development'], archived: false });
function workflow() {
  return { ...emptyStoryWorkflow(), references: [{ id: 'mara-stable-id', versions: [image()] }, { id: 'cinema-stable-id', versions: [image('Cinema')] }] };
}
const transferred = [{ id: 'mara-stable-id', version: 1, title: 'Mara', rights: 'creator-owned' as const, approval: 'approved' as const,
  allowedUses: ['story-development'], content: { kind: 'image' as const, mimeType: 'image/png' as const, base64: 'AAAA' } }];
const assistantInput = { version: 1, projectId: 'project', premiseNodeId: 'premise', premise: 'Use @image1 for Mara.', goal: 'expand',
  anchorSceneId: null, context: [], explicit: [], references: transferred, referenceRevision: 0 };

describe('compact prompt composer — stable reference identity', () => {
  it('keeps aliases stable when images are archived, renamed or appended', () => {
    const data = workflow();
    expect(storyImageAliases(data).map((item) => [item.alias, item.referenceId])).toEqual([['@image1', 'mara-stable-id'], ['@image2', 'cinema-stable-id']]);
    data.references[0].versions.push({ ...image('Renamed Mara'), version: 2, archived: true });
    data.references.push({ id: 'third-id', versions: [image()] });
    expect(storyImageAliases(data).map((item) => [item.alias, item.referenceId])).toEqual([['@image1', 'mara-stable-id'], ['@image2', 'cinema-stable-id'], ['@image3', 'third-id']]);
    expect(resolvePromptReferenceMentions('Use @image2.', data)).toEqual([{ alias: '@image2', referenceId: 'cinema-stable-id', version: 1 }]);
    expect(() => resolvePromptReferenceMentions('Use @image1.', data)).toThrow(/not approved/);
  });
  it('keeps notes in the immutable library index and deduplicates case-insensitive repeated mentions', () => {
    const data = workflow(); data.references[0].versions[0].content = { kind: 'note', text: 'Direction' };
    expect(storyImageAliases(data)[0].alias).toBe('@image2');
    expect(promptImageAliases('Use @Image2 and again @image2.')).toEqual(['@image2']);
    expect(() => resolvePromptReferenceMentions('@image1', data)).toThrow(/missing/);
    expect(() => promptImageAliases('@image0')).toThrow(/invalid/);
    expect(() => promptImageAliases('@image1oops')).toThrow(/invalid/);
  });
  it('rejects missing, revoked, unapproved, unsupported or unbound references', () => {
    const data = workflow();
    expect(() => resolvePromptReferenceMentions('@image9', data)).toThrow(/missing/);
    expect(() => resolvePromptReferenceMentions('@image1', data, ['cinema-stable-id'])).toThrow(/binding/);
    expect(() => resolvePromptReferenceMentions('@image1', data, undefined, 'video-generation')).toThrow(/permission/);
    for (const patch of [{ rights: 'unknown' as const }, { approval: 'pending' as const }, { approval: 'revoked' as const }]) {
      const changed = workflow(); Object.assign(changed.references[0].versions[0], patch);
      expect(() => resolvePromptReferenceMentions('@image1', changed)).toThrow(/not approved/);
    }
  });
  it('prevents library reorder/deletion and invalidates changed reference bytes', () => {
    const project = updateStoryWorkflow(createEmptyCinemaProjectData(), 0, (data) => { data.references = workflow().references; });
    expect(() => updateStoryWorkflow(project, 1, (data) => data.references.reverse())).toThrow(/identity\/order/);
    expect(() => updateStoryWorkflow(project, 1, (data) => { data.references.splice(0, 1); })).toThrow(/identity\/order/);
    const revised = reviseStoryReference(project, 1, 'mara-stable-id', { content: { ...image().content, kind: 'image', blobHash: 'b'.repeat(64), mimeType: 'image/png', width: 1, height: 1, byteSize: 12 } });
    expect(() => resolvePromptReferenceMentions('@image1', revised.storyWorkflow)).toThrow(/not approved/);
  });
  it('requires exact ID/version bindings at the assistant and story request boundaries', () => {
    const mentions = resolvePromptReferenceMentions(assistantInput.premise, workflow());
    expect(AssistantInputSchema.safeParse(assistantInput).success).toBe(false);
    expect(AssistantInputSchema.safeParse({ ...assistantInput, referenceMentions: mentions }).success).toBe(true);
    expect(AssistantInputSchema.safeParse({ ...assistantInput, referenceMentions: [{ ...mentions[0], version: 2 }] }).success).toBe(false);
    expect(transferredPromptMentionsValid('@image1', mentions, [{ ...transferred[0], content: { kind: 'note' } }])).toBe(false);
    const story = { version: 1, projectId: 'project', count: 1, context: [], anchorSceneId: null, references: transferred,
      brief: { version: 1, mode: 'expand', sourceDigest: 'a'.repeat(64), premise: assistantInput.premise, aspectRatio: '9:16', platform: 'other',
        durationSeconds: 60, durationScope: 'whole-story', tone: 'Horror', genres: ['Horror', 'Mystery'], ending: 'Cliffhanger', constraints: [], assumptions: [], status: 'approved', answers: [] } };
    expect(StoryInputSchema.safeParse(story).success).toBe(false);
    expect(StoryInputSchema.safeParse({ ...story, referenceMentions: mentions }).success).toBe(true);
  });
});

describe('optional multi-genre direction', () => {
  it('allows zero through five distinct genres, including custom genres', () => {
    expect(StoryGenresSchema.parse([])).toEqual([]);
    expect(StoryGenresSchema.parse(['Horror', 'Mystery'])).toHaveLength(2);
    expect(StoryGenresSchema.parse(['A', 'B', 'C', 'D', 'E'])).toHaveLength(5);
    expect(StoryGenresSchema.safeParse(['Horror', 'horror']).success).toBe(false);
    expect(StoryGenresSchema.safeParse(['A', 'B', 'C', 'D', 'E', 'F']).success).toBe(false);
  });
  it('carries multiple genres and distinct tone into existing scene briefs', () => {
    expect(storyGenreTone({ genres: ['Horror', 'Mystery'], tone: 'horror' })).toBe('Horror · Mystery');
    expect(storyGenreTone({ genres: ['Horror', 'Mystery'], tone: 'Restrained' })).toBe('Horror · Mystery · Restrained');
    expect(storyGenreTone({ tone: 'Suspense' })).toBe('Suspense');
  });
});
