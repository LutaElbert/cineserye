import type { CinemaProjectData } from '../domain/cinema/project-data';

export type MediaRoot = { cinema?: CinemaProjectData | null };

/** One traversal for cleanup, history/recovery, and future attachment migrations. */
export function collectMediaHashes(roots: readonly (MediaRoot | null | undefined)[]): Set<string> {
  const hashes = new Set<string>();
  for (const root of roots) {
    for (const reference of root?.cinema?.storyWorkflow?.references ?? []) {
      for (const version of reference.versions) if (version.content.kind === 'image') hashes.add(version.content.blobHash);
    }
    const visual = root?.cinema?.visualPreproduction;
    if (!visual) continue;
    for (const reference of Object.values(visual.references)) if (reference.blobHash) hashes.add(reference.blobHash);
    for (const frame of Object.values(visual.storyboardFrames)) hashes.add(frame.blobHash);
    for (const clip of Object.values(visual.videoClips)) hashes.add(clip.blobHash);
  }
  return hashes;
}

export function unreferencedMediaHashes(
  candidates: readonly string[], roots: readonly (MediaRoot | null | undefined)[],
): string[] {
  const used = collectMediaHashes(roots);
  return [...new Set(candidates)].filter((hash) => !used.has(hash));
}
