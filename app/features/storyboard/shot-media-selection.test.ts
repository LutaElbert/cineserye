import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { createEmptyVisualPreproductionData, type CinemaStoryboardFrameRecord, type CinemaVideoClipRecord } from '../../domain/cinema/visual-preproduction';
import { selectShotMediaPreview } from './shot-media-selection';

function fixture() {
  const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  const shot = Object.values(cinema.shots)[0];
  const imagePrompt = Object.values(cinema.prompts).find((prompt) => prompt.ownerNodeId === shot.nodeId && prompt.purpose === 'storyboard')!;
  const videoPrompt = Object.values(cinema.prompts).find((prompt) => prompt.ownerNodeId === shot.nodeId && prompt.purpose === 'video')!;
  const visual = createEmptyVisualPreproductionData(); cinema.visualPreproduction = visual;
  const frame = { id: 'frame-1', shotId: shot.id, revisionId: cinema.activeRevisionId!, promptId: imagePrompt.id, promptVersion: imagePrompt.version,
    status: 'candidate', safetyStatus: 'passed', createdAt: '2026-09-07T01:00:00Z', blobHash: 'a'.repeat(64) } as CinemaStoryboardFrameRecord;
  const clip = { id: 'clip-1', shotId: shot.id, revisionId: cinema.activeRevisionId!, promptId: videoPrompt.id, promptVersion: videoPrompt.version,
    startFrameId: frame.id, status: 'approved', createdAt: '2026-09-07T02:00:00Z', blobHash: 'b'.repeat(64) } as CinemaVideoClipRecord;
  return { cinema, shot, visual, frame, clip, imagePrompt, videoPrompt };
}

describe('semantic shot media preview selection', () => {
  it('evolves the same shot through plan, image candidate, approved image and approved video', () => {
    const { cinema, shot, visual, frame, clip } = fixture();
    expect(selectShotMediaPreview(cinema, shot).stage).toBe('plan');
    visual.storyboardFrames[frame.id] = frame;
    expect(selectShotMediaPreview(cinema, shot)).toMatchObject({ stage: 'image', label: 'Image · Review candidate' });
    frame.status = 'approved';
    expect(selectShotMediaPreview(cinema, shot)).toMatchObject({ stage: 'image', label: 'Image · Approved frame' });
    visual.videoClips[clip.id] = clip;
    expect(selectShotMediaPreview(cinema, shot)).toMatchObject({ stage: 'video', clip, image: frame });
    expect(shot.id).toBe(clip.shotId);
  });
  it('uses the owning scene revision even when a different scene is globally selected', () => {
    const { cinema, shot, visual, frame } = fixture();
    frame.status = 'approved'; visual.storyboardFrames[frame.id] = frame;
    cinema.activeRevisionId = 'different-scene-revision';
    expect(selectShotMediaPreview(cinema, shot).image?.id).toBe(frame.id);
  });
  it('does not promote rejected, stale, superseded or unrelated media', () => {
    const { cinema, shot, visual, frame, clip, imagePrompt } = fixture();
    frame.status = 'rejected'; visual.storyboardFrames[frame.id] = frame; visual.videoClips[clip.id] = clip;
    expect(selectShotMediaPreview(cinema, shot).stage).toBe('plan');
    frame.status = 'approved'; imagePrompt.status = 'stale';
    expect(selectShotMediaPreview(cinema, shot).stage).toBe('plan');
    imagePrompt.status = 'approved'; frame.revisionId = 'old-revision';
    expect(selectShotMediaPreview(cinema, shot).stage).toBe('plan');
  });
  it('never makes candidate video look approved; newer candidates do not replace an approved frame', () => {
    const { cinema, shot, visual, frame, clip } = fixture();
    frame.status = 'approved'; visual.storyboardFrames[frame.id] = frame;
    visual.storyboardFrames.newer = { ...frame, id: 'newer', status: 'candidate', createdAt: '2026-09-07T03:00:00Z' };
    clip.status = 'candidate'; visual.videoClips[clip.id] = clip;
    expect(selectShotMediaPreview(cinema, shot)).toMatchObject({ stage: 'image', image: frame, clip: null });
  });
});
