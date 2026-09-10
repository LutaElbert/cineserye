import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import type { CinemaStoryboardFrameRecord, CinemaVideoClipRecord } from '../../domain/cinema/visual-preproduction';

export type ShotMediaSelection = {
  stage: 'plan' | 'image' | 'video';
  label: string;
  image: CinemaStoryboardFrameRecord | null;
  clip: CinemaVideoClipRecord | null;
  hasPreviousMedia: boolean;
};

/** The owning scene's accepted revision is authoritative, not global selection. */
export function selectShotMediaPreview(cinema: CinemaProjectData, shot: CinemaShotRecord): ShotMediaSelection {
  const visual = cinema.visualPreproduction;
  const revisions = Object.values(cinema.revisions).filter((revision) => revision.sceneId === shot.sceneId && revision.status === 'active');
  const previous = [...Object.values(visual?.storyboardFrames ?? {}), ...Object.values(visual?.videoClips ?? {})].some((entry) => entry.shotId === shot.id);
  const empty: ShotMediaSelection = { stage: 'plan', label: previous ? 'Plan · Media needs review' : 'Plan ready', image: null, clip: null, hasPreviousMedia: previous };
  if (revisions.length !== 1 || !revisions[0].snapshot.shots[shot.id]) return empty;
  const revisionId = revisions[0].id;
  const imagePrompt = Object.values(cinema.prompts).find((prompt) => prompt.ownerNodeId === shot.nodeId && prompt.purpose === 'storyboard');
  const videoPrompt = Object.values(cinema.prompts).find((prompt) => prompt.ownerNodeId === shot.nodeId && prompt.purpose === 'video');
  const newest = <T extends { createdAt: string; id: string }>(values: T[]) => values.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const frames = newest(Object.values(visual?.storyboardFrames ?? {}).filter((frame) => frame.shotId === shot.id && frame.revisionId === revisionId
    && frame.status !== 'rejected' && frame.safetyStatus === 'passed' && imagePrompt && imagePrompt.status !== 'stale'
    && frame.promptId === imagePrompt.id && frame.promptVersion === imagePrompt.version));
  const approvedFrames = frames.filter((frame) => frame.status === 'approved');
  const image = approvedFrames.length === 1 ? approvedFrames[0] : frames.find((frame) => frame.status === 'candidate') ?? null;
  const clips = newest(Object.values(visual?.videoClips ?? {}).filter((candidate) => candidate.shotId === shot.id && candidate.revisionId === revisionId
    && candidate.status === 'approved' && videoPrompt && videoPrompt.status !== 'stale'
    && candidate.promptId === videoPrompt.id && candidate.promptVersion === videoPrompt.version
    && approvedFrames.length === 1 && candidate.startFrameId === approvedFrames[0].id));
  const clip = clips.length === 1 ? clips[0] : null;
  if (clip) return { stage: 'video', label: 'Video · Approved take', image: approvedFrames[0], clip, hasPreviousMedia: previous };
  if (image) return { stage: 'image', label: image.status === 'approved' ? 'Image · Approved frame' : 'Image · Review candidate', image, clip: null, hasPreviousMedia: previous };
  return empty;
}
