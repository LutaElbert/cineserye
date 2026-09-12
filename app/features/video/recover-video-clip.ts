import type { CinemaVideoClipRecord, CinemaVideoOperationRecord } from '../../domain/cinema/visual-preproduction';
import { sha256Blob } from '../../editor/persistence';
import type { VideoOperationResponse } from './video-api';
import { persistVideoClipArtifact } from './video-storage';

/** Restore exact retained bytes only. No generation, creative adoption or approval.
 * The caller owns the full request scope and checks it again after persistence. */
export async function recoverRetainedVideoClip(options: {
  result: Extract<VideoOperationResponse, { ok: true }>;
  clip: CinemaVideoClipRecord;
  operation: CinemaVideoOperationRecord;
  ownsResult: () => boolean;
  persist?: typeof persistVideoClipArtifact;
}) {
  const { result, clip, operation, ownsResult } = options, returned = result.operation;
  if (!ownsResult()) return false;
  if (clip.operationId !== operation.id || returned.operationId !== operation.id
    || clip.shotId !== operation.shotId || clip.revisionId !== operation.revisionId
    || returned.provider !== operation.provider || returned.model !== operation.model
    || returned.provider !== clip.provider || returned.model !== clip.model
    || returned.capability.version !== clip.capabilityProfileVersion
    || returned.capability.version !== operation.capabilityProfileVersion) throw Error('The retained result does not match this clip’s ownership and provenance. Nothing was replaced.');
  const media = returned.clip;
  if (returned.status !== 'ready' || !media) throw Error('This existing request has no verified retained clip yet. No new generation was started.');
  if (media.id !== clip.id || media.byteSize !== clip.byteSize || media.width !== clip.width
    || media.height !== clip.height || media.durationSeconds !== clip.durationSeconds) throw Error('The retained result does not match this clip’s metadata. Nothing was replaced.');
  const bytes = Uint8Array.from(atob(media.base64), value => value.charCodeAt(0));
  if (bytes.length !== media.byteSize) throw Error('The retained clip has an invalid byte count. Nothing was replaced.');
  const blob = new Blob([bytes], { type: 'video/mp4' });
  if (await sha256Blob(blob) !== clip.blobHash) throw Error('The retained clip does not match its saved hash. Nothing was replaced.');
  if (!ownsResult()) return false;
  const saved = await (options.persist ?? persistVideoClipArtifact)({ blob, width: media.width, height: media.height });
  if (saved.hash !== clip.blobHash) throw Error('Local storage did not retain the expected clip hash.');
  return ownsResult();
}
