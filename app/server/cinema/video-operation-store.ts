import 'server-only';
import type { GenerateVideoRequest, VideoOperationSnapshot } from '../../features/video/video-api';
import type { VideoCapabilityProfile } from './video-capabilities';
import type { VideoProviderHandle } from './video-provider';
import { OperationRepository, operationDigest } from './operation-repository';
import { ProviderError } from './provider-errors';

export type VideoOwner = { projectId: string; sceneId: string; shotId: string; revisionId: string; operationId: string };
export type SavedVideoOperation = {
  version: 1;
  owner: VideoOwner;
  digest: string;
  mode: 'fixture' | 'live';
  provider: { id: string; model: string; project: string | null; location: string | null };
  capability: VideoCapabilityProfile;
  /** Retain no reference bytes or prompt text in the polling checkpoint. */
  settings: GenerateVideoRequest['settings'];
  handle: Pick<VideoProviderHandle, 'name' | 'startedAt'>;
  status: VideoOperationSnapshot['status'];
  estimatedCost: number | null;
  currency: 'USD' | null;
  error: string | null;
  clip: VideoOperationSnapshot['clip'];
};
const TERMINAL = new Set(['ready', 'failed', 'cancelled', 'timed-out']);
const keyFor = (owner: VideoOwner) => `video:${operationDigest(owner)}`;
const unknownMessage = 'The provider start outcome is unknown. This operation will not be dispatched again; inspect provider activity before approving any new request.';

/** Durable single-local-operator adapter; a scope is not hosted tenant authentication. */
export class VideoOperationStore {
  private readonly starting = new Map<string, { digest: string; promise: Promise<SavedVideoOperation> }>();
  private readonly polling = new Map<string, Promise<SavedVideoOperation>>();
  private starts = 0;
  constructor(private readonly repository: OperationRepository) {}
  close() { this.repository.close(); }
  read(owner: VideoOwner): SavedVideoOperation {
    const row = this.repository.read(keyFor(owner));
    if (!row || row.status === 'expired' || !row.result) throw new ProviderError('INVALID_REQUEST', 'That owned video operation is unavailable or its retained result expired. It will not be regenerated automatically.');
    let saved: SavedVideoOperation;
    try { saved = JSON.parse(row.result) as SavedVideoOperation; } catch { throw new ProviderError('UNEXPECTED_RESPONSE', 'The saved video checkpoint is unreadable.'); }
    if (saved.version !== 1 || operationDigest(saved.owner) !== operationDigest(owner) || saved.digest !== row.digest) throw new ProviderError('UNEXPECTED_RESPONSE', 'The saved video checkpoint failed ownership validation.');
    if (row.status === 'unknown' || (row.status === 'pending' && !saved.handle.name && !this.starting.has(keyFor(owner)))) return { ...saved, status: 'failed', error: unknownMessage, clip: null };
    return saved;
  }
  async start(initial: SavedVideoOperation, dispatch: () => Promise<VideoProviderHandle>): Promise<SavedVideoOperation> {
    const key = keyFor(initial.owner), running = this.starting.get(key);
    if (running) {
      if (running.digest !== initial.digest) throw new ProviderError('INVALID_REQUEST', 'This running operation has different content.');
      return running.promise;
    }
    const claim = this.repository.claim(key, initial.digest);
    if (!claim.claimed) return this.read(initial.owner);
    // Claim and checkpoint precede external dispatch. A crash cannot purchase a retry.
    this.repository.checkpoint(key, initial.digest, initial);
    if (++this.starts > 200) { this.repository.unknown(key); throw new ProviderError('PROVIDER_UNAVAILABLE', 'The local video dispatch limit was reached.'); }
    const promise = Promise.resolve().then(dispatch).then((handle) => {
      if (!handle.name || !Number.isFinite(handle.startedAt)) throw new Error('Missing provider operation handle.');
      const latest = this.read(initial.owner);
      if (TERMINAL.has(latest.status)) return latest; // Cancel won while start was in flight.
      const saved = { ...initial, handle: { name: handle.name, startedAt: handle.startedAt } };
      this.repository.checkpoint(key, initial.digest, saved);
      return saved;
    }).catch(() => {
      const latest = this.read(initial.owner);
      if (TERMINAL.has(latest.status)) return latest;
      this.repository.unknown(key);
      return { ...initial, status: 'failed' as const, error: unknownMessage };
    }).finally(() => this.starting.delete(key));
    this.starting.set(key, { digest: initial.digest, promise });
    return promise;
  }
  async poll(owner: VideoOwner, update: (saved: SavedVideoOperation) => Promise<SavedVideoOperation>): Promise<SavedVideoOperation> {
    const key = keyFor(owner), running = this.polling.get(key);
    if (running) return running;
    const saved = this.read(owner);
    if (TERMINAL.has(saved.status) || !saved.handle.name) return saved;
    const promise = update(saved).then((next) => {
      const latest = this.read(owner);
      if (TERMINAL.has(latest.status)) return latest; // Never revive a cancelled take.
      if (operationDigest(next.owner) !== operationDigest(owner) || next.digest !== saved.digest) throw new ProviderError('INVALID_REQUEST', 'A polling update changed its owned scope.');
      if (TERMINAL.has(next.status)) this.repository.complete(key, next);
      else this.repository.checkpoint(key, next.digest, next);
      return next;
    }).finally(() => this.polling.delete(key));
    this.polling.set(key, promise);
    return promise;
  }
  cancel(owner: VideoOwner): SavedVideoOperation {
    const saved = this.read(owner);
    if (TERMINAL.has(saved.status)) return saved;
    const next: SavedVideoOperation = { ...saved, status: 'cancelled', error: 'Cancelled locally by creator. Provider processing and billing may continue.', clip: null };
    this.repository.complete(keyFor(owner), next);
    return next;
  }
}

let local: { path: string; promise: Promise<VideoOperationStore> } | undefined;
export function localVideoOperationStore() {
  const path = process.env.CINESERYE_VIDEO_OPERATION_DB_PATH?.trim() || '.wrangler/cineserye-video-operations.sqlite';
  if (!local || local.path !== path) local = { path, promise: OperationRepository.open(path).then((repository) => new VideoOperationStore(repository)).catch(() => {
    local = undefined;
    throw new ProviderError('INVALID_CONFIGURATION', 'Durable local video storage is unavailable. No provider request was started.');
  }) };
  return local.promise;
}
