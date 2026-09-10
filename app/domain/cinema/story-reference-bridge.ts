import type { CinemaProjectData } from './project-data';
import type { StoryWorkflowData } from './story-workflow';
import { reviewStoryReferenceTransfer } from './story-workflow';
import type { CinemaReferenceRecord } from './visual-preproduction';

/** Immutable version identity for output provenance; no duplicated library records. */
export const storyReferenceSnapshotId = (id: string, version: number) => `story-ref:${id}:v${version}`;
export function storyReferenceSnapshot(workflow: StoryWorkflowData | undefined, id: string) {
  const match = /^story-ref:(.+):v([1-9][0-9]*)$/.exec(id);
  return match ? workflow?.references.find((item) => item.id === match[1])?.versions[Number(match[2]) - 1] : undefined;
}
export function storyImageReferences(project: CinemaProjectData, shotId: string): CinemaReferenceRecord[] {
  if (!project.storyWorkflow) return [];
  return reviewStoryReferenceTransfer(project, { kind: 'shot', id: shotId }, 'image-generation',
    { maxImages: 8, maxBytes: 12 * 1024 * 1024, maxNoteCharacters: 20_000 }).included.flatMap((item) => {
    const value = item.current; const content = value.content;
    if (content.kind !== 'image') return [];
    return [{ id: storyReferenceSnapshotId(item.referenceId, value.version), sceneId: project.shots[shotId].sceneId,
      title: `${value.title} (story v${value.version})`, type: value.category, origin: 'upload', mimeType: content.mimeType,
      width: content.width, height: content.height, byteSize: content.byteSize, blobHash: content.blobHash, sourceUrl: null,
      provenance: value.provenance, rightsStatus: value.rights, approvalStatus: value.approval,
      allowedUses: value.allowedUses.filter((use): use is 'research' | 'image-generation' | 'video-generation' => ['research', 'image-generation', 'video-generation'].includes(use)),
      notes: '', shotIds: [shotId], pinned: false, createdAt: '' }];
  });
}
