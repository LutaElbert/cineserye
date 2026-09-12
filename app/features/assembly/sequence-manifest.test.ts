import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { createEmptyVisualPreproductionData, type CinemaStoryboardFrameRecord, type CinemaVideoClipRecord } from '../../domain/cinema/visual-preproduction';
import { buildSequenceManifest, defaultSequenceTrim, SequenceManifestSchema, sequenceRows, sequenceRuntime, sequenceTimingIssue } from './sequence-manifest';

const manifest = {
  version: 1, aspectRatio: '9:16', resolution: '720p', fps: 24, audio: 'silent', confirmedLocalRender: true,
  clips: [{ shotId: 'shot-1', clipId: 'clip-1', blobHash: 'a'.repeat(64), startFrame: 24, durationFrames: 120 }],
};

describe('local sequence manifest', () => {
  it('tracks edit runtime separately from provider clip duration', () => {
    expect(sequenceRuntime(SequenceManifestSchema.parse(manifest))).toBe(5);
    expect(defaultSequenceTrim({ ...Object.values(MOCK_CINEMA_PROJECT_DATA.shots)[0], durationSeconds: 5 })).toEqual({ startFrame: 0, durationFrames: 120 });
  });
  it('reports trims that exceed decoded footage before local rendering', () => {
    expect(sequenceTimingIssue({ startFrame: 0, durationFrames: 48 }, 1)).toMatch(/Decoded clip is 1.00s/);
    expect(sequenceTimingIssue({ startFrame: 12, durationFrames: 24 }, 1)).toMatch(/selected 0.50s start and 1.00s use/);
    expect(sequenceTimingIssue({ startFrame: 0, durationFrames: 24 }, 1)).toBeNull();
  });
  it('rejects unbounded, duplicate, non-MP4 settings and arbitrary paths', () => {
    expect(SequenceManifestSchema.safeParse({ ...manifest, path: '/etc/passwd' }).success).toBe(false);
    expect(SequenceManifestSchema.safeParse({ ...manifest, audio: 'preserve' }).success).toBe(false);
    expect(SequenceManifestSchema.safeParse({ ...manifest, clips: [manifest.clips[0], manifest.clips[0]] }).success).toBe(false);
    expect(SequenceManifestSchema.safeParse({ ...manifest, clips: [{ ...manifest.clips[0], durationFrames: 24 * 121 }] }).success).toBe(false);
    expect(SequenceManifestSchema.safeParse({ ...manifest, clips: [{ ...manifest.clips[0], startFrame: -1 }] }).success).toBe(false);
    expect(SequenceManifestSchema.safeParse({ ...manifest, confirmedLocalRender: false }).success).toBe(false);
  });
  it('follows story scene order and shot narrative order, never clip creation order', () => {
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const firstScene = cinema.scenes[cinema.sceneOrder[0]];
    const shot = cinema.shots[firstScene.shotIds[0]];
    cinema.scenes.second = { ...firstScene, id: 'second', title: 'Second scene', shotIds: ['second-shot'] };
    cinema.shots['second-shot'] = { ...shot, id: 'second-shot', sceneId: 'second', order: 1 };
    cinema.sceneOrder = ['second', firstScene.id];
    firstScene.shotIds.reverse();
    const rows = sequenceRows(cinema);
    expect(rows[0].shot.id).toBe('second-shot');
    expect(rows[1].shot.order).toBe(1);
    expect(rows.every((row) => row.issue !== null)).toBe(true);
    expect(() => buildSequenceManifest(rows, {}, '9:16')).toThrow(/approved/i);
  });
  it('requires current approved take, revision, prompt and anchor without changing approvals', () => {
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const scene = cinema.scenes[cinema.sceneOrder[0]];
    scene.shotIds = [scene.shotIds[0]];
    const shot = cinema.shots[scene.shotIds[0]];
    const prompt = Object.values(cinema.prompts).find((item) => item.ownerNodeId === shot.nodeId && item.purpose === 'video')!;
    const visual = createEmptyVisualPreproductionData(); cinema.visualPreproduction = visual;
    visual.storyboardFrames.anchor = { id: 'anchor', status: 'approved' } as CinemaStoryboardFrameRecord;
    visual.videoClips.take = {
      id: 'take', shotId: shot.id, revisionId: cinema.activeRevisionId!, promptId: prompt.id, promptVersion: prompt.version,
      startFrameId: 'anchor', status: 'approved', blobHash: 'b'.repeat(64),
    } as CinemaVideoClipRecord;
    expect(sequenceRows(cinema)[0].issue).toBeNull();
    expect(buildSequenceManifest(sequenceRows(cinema), {}, '9:16').clips[0].clipId).toBe('take');
    prompt.status = 'stale';
    expect(sequenceRows(cinema)[0].issue).toMatch(/current plan/);
    expect(visual.videoClips.take.status).toBe('approved');
  });
});
