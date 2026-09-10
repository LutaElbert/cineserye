import { z } from 'zod';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import type { CinemaVideoClipRecord } from '../../domain/cinema/visual-preproduction';

export const ASSEMBLY_LIMITS = {
  fps: 24, maxClips: 24, maxRuntimeSeconds: 120,
  maxClipBytes: 50 * 1024 * 1024, maxTotalBytes: 200 * 1024 * 1024,
  timeoutMs: 120_000,
} as const;

const identifier = z.string().min(1).max(160);
export const SequenceManifestSchema = z.object({
  version: z.literal(1),
  aspectRatio: z.enum(['9:16', '16:9']),
  resolution: z.literal('720p'),
  fps: z.literal(24),
  audio: z.literal('silent'),
  confirmedLocalRender: z.literal(true),
  clips: z.array(z.object({
    shotId: identifier, clipId: identifier,
    blobHash: z.string().regex(/^[a-f0-9]{64}$/),
    startFrame: z.number().int().min(0).max(24 * 120),
    durationFrames: z.number().int().min(1).max(24 * 120),
  }).strict()).min(1).max(ASSEMBLY_LIMITS.maxClips),
}).strict().superRefine((manifest, context) => {
  if (manifest.clips.reduce((sum, clip) => sum + clip.durationFrames, 0) > ASSEMBLY_LIMITS.maxRuntimeSeconds * 24) {
    context.addIssue({ code: 'custom', message: 'The local sequence is limited to 120 seconds.' });
  }
  if (new Set(manifest.clips.map((clip) => clip.shotId)).size !== manifest.clips.length
    || new Set(manifest.clips.map((clip) => clip.clipId)).size !== manifest.clips.length) {
    context.addIssue({ code: 'custom', message: 'A shot or selected take appears more than once.' });
  }
});

export type SequenceManifest = z.infer<typeof SequenceManifestSchema>;
export type SequenceTrim = { startFrame: number; durationFrames: number };
export type SequenceRow = { shot: CinemaShotRecord; sceneTitle: string; clip: CinemaVideoClipRecord | null; issue: string | null };

/** Narrative order, never generation completion order or canvas coordinates. */
export function sequenceRows(cinema: CinemaProjectData): SequenceRow[] {
  const visual = cinema.visualPreproduction;
  return cinema.sceneOrder.flatMap((sceneId) => {
    const scene = cinema.scenes[sceneId];
    if (!scene) return [];
    return [...scene.shotIds].map((id) => cinema.shots[id]).filter((shot): shot is CinemaShotRecord => Boolean(shot))
      .sort((left, right) => left.order - right.order).map((shot) => {
        const approved = Object.values(visual?.videoClips ?? {}).filter((clip) => clip.shotId === shot.id && clip.status === 'approved');
        const clip = approved.length === 1 ? approved[0] : null;
        let issue = approved.length > 1 ? 'Choose one approved take.' : !clip ? 'Approve a video take for this shot.' : null;
        if (clip) {
          const revision = cinema.revisions[clip.revisionId];
          const prompt = cinema.prompts[clip.promptId];
          const frame = visual?.storyboardFrames[clip.startFrameId];
          if (!revision || revision.sceneId !== sceneId || revision.status !== 'active'
            || !prompt || prompt.status === 'stale' || prompt.version !== clip.promptVersion
            || !frame || frame.status !== 'approved') issue = 'This take needs review against the current plan and approved frame.';
        }
        return { shot, sceneTitle: scene.title, clip, issue };
      });
  });
}

export function defaultSequenceTrim(shot: CinemaShotRecord): SequenceTrim {
  return { startFrame: 0, durationFrames: Math.max(1, Math.round(shot.durationSeconds * ASSEMBLY_LIMITS.fps)) };
}

export function buildSequenceManifest(rows: SequenceRow[], trims: Record<string, SequenceTrim>, aspectRatio: '9:16' | '16:9'): SequenceManifest {
  if (rows.some((row) => row.issue || !row.clip)) throw new Error('Every shot needs a current approved video take before assembly.');
  return SequenceManifestSchema.parse({
    version: 1, aspectRatio, resolution: '720p', fps: 24, audio: 'silent', confirmedLocalRender: true,
    clips: rows.map(({ shot, clip }) => ({ shotId: shot.id, clipId: clip!.id, blobHash: clip!.blobHash, ...(trims[shot.id] ?? defaultSequenceTrim(shot)) })),
  });
}

export function sequenceRuntime(manifest: SequenceManifest): number {
  return manifest.clips.reduce((sum, clip) => sum + clip.durationFrames, 0) / manifest.fps;
}
