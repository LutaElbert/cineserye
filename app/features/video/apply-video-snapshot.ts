import type { CinemaVisualPreproductionData } from '../../domain/cinema/visual-preproduction';
import { canonicalRequest } from '../../domain/cinema/request-digest';
import type { VideoOperationResponse } from './video-api';
import { persistVideoClipArtifact } from './video-storage';
import { terminalVideoStatuses, unresolvedVideoOperation } from './video-operation-state';

export { terminalVideoStatuses } from './video-operation-state';
type Visual = CinemaVisualPreproductionData;
type Record = Visual['videoOperations'][string];
function identity(value: Record) {
  const { status, error, completedAt, providerOperationId, failureConfirmed, ...source } = value;
  void status; void error; void completedAt; void providerOperationId; void failureConfirmed;
  return canonicalRequest(source);
}

/** Provider observations do not authorize adopting into another document. Check
 * ownership after local artifact persistence and inside the receiver updater. */
export async function applyOwnedVideoSnapshot(options: {
  result: Extract<VideoOperationResponse, { ok: true }>;
  ownsResult: () => boolean;
  current: () => Visual | undefined;
  update: (updater: (current: Visual) => Visual) => void;
  persist?: typeof persistVideoClipArtifact;
}) {
  const { operation } = options.result;
  const initial = options.current()?.videoOperations[operation.operationId];
  if (!options.ownsResult() || !initial) return false;
  if (initial.provider !== operation.provider || initial.model !== operation.model || initial.capabilityProfileVersion !== operation.capability.version) {
    throw Error('The video response has different provider provenance. Check the existing request again.');
  }
  const fingerprint = identity(initial);
  const eligible = (state: Visual | undefined) => {
    const latest = state?.videoOperations[operation.operationId];
    return options.ownsResult() && latest && identity(latest) === fingerprint
      && (!terminalVideoStatuses.has(latest.status) || unresolvedVideoOperation(latest) || latest.status === operation.status);
  };
  if (!eligible(options.current())) return false;
  let clip: Visual['videoClips'][string] | undefined;
  if (operation.clip && !options.current()?.videoClips[operation.clip.id]) {
    const bytes = Uint8Array.from(atob(operation.clip.base64), char => char.charCodeAt(0));
    if (bytes.length !== operation.clip.byteSize) throw Error('The returned clip does not match its declared bytes. Check the existing request again.');
    const media = await (options.persist ?? persistVideoClipArtifact)({ blob: new Blob([bytes], { type: 'video/mp4' }), width: operation.clip.width, height: operation.clip.height });
    if (!eligible(options.current())) return false;
    clip = { id: operation.clip.id, operationId: operation.operationId, shotId: initial.shotId, revisionId: initial.revisionId,
      promptId: initial.promptId, promptVersion: initial.promptVersion, startFrameId: initial.startFrameId, endFrameId: initial.endFrameId,
      referenceIds: [...initial.referenceIds], provider: operation.provider, model: operation.model, capabilityProfileVersion: operation.capability.version,
      settings: { ...initial.settings }, blobHash: media.hash, mimeType: 'video/mp4', width: operation.clip.width, height: operation.clip.height,
      byteSize: bytes.length, durationSeconds: operation.clip.durationSeconds, status: 'candidate', estimatedCost: operation.estimatedCost,
      currency: operation.currency, createdAt: new Date().toISOString() };
  }
  if (!eligible(options.current())) return false;
  options.update(state => {
    if (!eligible(state)) return state;
    const latest = state.videoOperations[operation.operationId];
    if (!clip && latest.status === operation.status && latest.error === operation.error && latest.providerOperationId === operation.providerOperationId && Boolean(latest.failureConfirmed) === Boolean(operation.failureConfirmed)) return state;
    return { ...state, videoOperations: { ...state.videoOperations, [operation.operationId]: { ...latest, status: operation.status,
      provider: operation.provider, model: operation.model, providerOperationId: operation.providerOperationId,
      failureConfirmed: operation.status === 'failed' && operation.failureConfirmed === true,
      completedAt: terminalVideoStatuses.has(operation.status) ? latest.completedAt ?? new Date().toISOString() : null, error: operation.error } },
      videoClips: clip ? { ...state.videoClips, [clip.id]: clip } : state.videoClips };
  });
  return terminalVideoStatuses.has(operation.status) || operation.status === 'unknown';
}
